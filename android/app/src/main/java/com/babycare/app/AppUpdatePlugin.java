package com.babycare.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private final ExecutorService downloadExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloadRunning = new AtomicBoolean(false);
    private final AtomicBoolean pauseRequested = new AtomicBoolean(false);
    private volatile HttpURLConnection activeConnection;

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        String rawPath = call.getString("path");
        if (url == null || url.isEmpty() || rawPath == null || rawPath.isEmpty()) {
            call.reject("下载地址或文件路径无效", "INVALID_DOWNLOAD_OPTIONS");
            return;
        }
        if (!downloadRunning.compareAndSet(false, true)) {
            call.reject("已有更新正在下载", "DOWNLOAD_IN_PROGRESS");
            return;
        }

        pauseRequested.set(false);
        downloadExecutor.execute(() -> {
            File target = fileFromPath(rawPath);
            try {
                File parent = target.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    throw new IOException("无法创建更新缓存目录");
                }
                boolean completed = transfer(url, target);
                JSObject result = new JSObject();
                result.put("path", rawPath);
                result.put("paused", !completed);
                result.put("completed", completed);
                result.put("bytes", target.length());
                call.resolve(result);
            } catch (IOException error) {
                if (pauseRequested.get()) {
                    JSObject result = new JSObject();
                    result.put("path", rawPath);
                    result.put("paused", true);
                    result.put("completed", false);
                    result.put("bytes", target.length());
                    call.resolve(result);
                } else {
                    call.reject("更新下载失败，请检查网络后重试", "DOWNLOAD_FAILED", error);
                }
            } finally {
                activeConnection = null;
                downloadRunning.set(false);
            }
        });
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        if (!downloadRunning.get()) {
            call.resolve(new JSObject());
            return;
        }
        pauseRequested.set(true);
        HttpURLConnection connection = activeConnection;
        if (connection != null) connection.disconnect();
        // This task runs only after the active transfer has closed its file and connection.
        downloadExecutor.execute(() -> call.resolve(new JSObject()));
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String rawPath = call.getString("path");
        if (rawPath == null || rawPath.isEmpty()) {
            call.reject("安装文件路径无效", "INVALID_APK_PATH");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
            );
            settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settingsIntent);
            call.reject("请允许 XiXiCare 安装应用后返回重试", "INSTALL_PERMISSION_REQUIRED");
            return;
        }

        File apkFile = fileFromPath(rawPath);
        if (!apkFile.exists()) {
            call.reject("下载的安装包不存在，请重新下载", "APK_NOT_FOUND");
            return;
        }

        try {
            Uri apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apkFile
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(installIntent);
            call.resolve(new JSObject());
        } catch (IllegalArgumentException | ActivityNotFoundException error) {
            call.reject("无法打开安装程序，请稍后重试", "INSTALLER_UNAVAILABLE", error);
        }
    }

    private boolean transfer(String sourceUrl, File target) throws IOException {
        long existingBytes = target.exists() ? target.length() : 0;
        HttpURLConnection connection = openConnection(sourceUrl, existingBytes);
        int responseCode = connection.getResponseCode();
        boolean resuming = existingBytes > 0 && responseCode == HttpURLConnection.HTTP_PARTIAL;
        if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_PARTIAL) {
            connection.disconnect();
            throw new IOException("HTTP " + responseCode);
        }

        long startByte = resuming ? existingBytes : 0;
        long contentLength = connection.getContentLengthLong();
        long totalBytes = contentLength > 0 ? startByte + contentLength : 0;
        long downloadedBytes = startByte;
        long lastProgressAt = 0;

        try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
             RandomAccessFile output = new RandomAccessFile(target, "rw")) {
            if (resuming) {
                output.seek(existingBytes);
            } else {
                output.setLength(0);
            }
            notifyProgress(downloadedBytes, totalBytes);

            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (pauseRequested.get()) {
                    output.getFD().sync();
                    return false;
                }
                output.write(buffer, 0, count);
                downloadedBytes += count;
                long now = System.currentTimeMillis();
                if (now - lastProgressAt >= 150) {
                    notifyProgress(downloadedBytes, totalBytes);
                    lastProgressAt = now;
                }
            }
            output.getFD().sync();
        } finally {
            connection.disconnect();
        }

        if (totalBytes > 0 && downloadedBytes != totalBytes) {
            throw new IOException("更新文件下载不完整");
        }
        notifyProgress(downloadedBytes, totalBytes > 0 ? totalBytes : downloadedBytes);
        return true;
    }

    private HttpURLConnection openConnection(String sourceUrl, long offset) throws IOException {
        URL currentUrl = new URL(sourceUrl);
        for (int redirect = 0; redirect < 6; redirect += 1) {
            HttpURLConnection connection = (HttpURLConnection) currentUrl.openConnection();
            connection.setConnectTimeout(60_000);
            connection.setReadTimeout(120_000);
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream");
            connection.setRequestProperty("User-Agent", "XiXiCare-Android-Updater");
            if (offset > 0) connection.setRequestProperty("Range", "bytes=" + offset + "-");
            connection.setInstanceFollowRedirects(false);
            activeConnection = connection;

            int responseCode = connection.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_MOVED_PERM
                    || responseCode == HttpURLConnection.HTTP_MOVED_TEMP
                    || responseCode == HttpURLConnection.HTTP_SEE_OTHER
                    || responseCode == 307
                    || responseCode == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.isEmpty()) throw new IOException("更新下载重定向无效");
                currentUrl = new URL(currentUrl, location);
                continue;
            }
            return connection;
        }
        throw new IOException("更新下载重定向次数过多");
    }

    private void notifyProgress(long bytes, long totalBytes) {
        JSObject progress = new JSObject();
        progress.put("bytes", bytes);
        progress.put("contentLength", totalBytes);
        progress.put("lengthComputable", totalBytes > 0);
        notifyListeners("downloadProgress", progress);
    }

    private File fileFromPath(String rawPath) {
        Uri sourceUri = Uri.parse(rawPath);
        return "file".equals(sourceUri.getScheme()) ? new File(sourceUri.getPath()) : new File(rawPath);
    }

    @Override
    protected void handleOnDestroy() {
        pauseRequested.set(true);
        downloadExecutor.shutdownNow();
        super.handleOnDestroy();
    }
}
