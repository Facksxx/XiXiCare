package com.xixicare.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "SoundDownload")
public class SoundDownloadPlugin extends Plugin {
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, HttpURLConnection> connections = new ConcurrentHashMap<>();
    private final Set<String> cancelled = ConcurrentHashMap.newKeySet();

    @PluginMethod
    public void download(PluginCall call) {
        String id = call.getString("id");
        String source = call.getString("url");
        String rawPath = call.getString("path");
        if (id == null || source == null || rawPath == null) {
            call.reject("下载参数无效", "INVALID_OPTIONS");
            return;
        }
        cancelled.remove(id);
        executor.execute(() -> {
            File target = fileFromPath(rawPath);
            try {
                File parent = target.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IOException("无法创建目录");
                transfer(id, source, target);
                if (cancelled.contains(id)) throw new IOException("cancelled");
                call.resolve();
            } catch (IOException error) {
                if (target.exists()) target.delete();
                call.reject(cancelled.contains(id) ? "下载已取消" : "声音下载失败", cancelled.contains(id) ? "CANCELLED" : "DOWNLOAD_FAILED", error);
            } finally {
                connections.remove(id);
                cancelled.remove(id);
            }
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");
        if (id != null) {
            cancelled.add(id);
            HttpURLConnection connection = connections.get(id);
            if (connection != null) connection.disconnect();
        }
        call.resolve();
    }

    private void transfer(String id, String source, File target) throws IOException {
        HttpURLConnection connection = openConnection(id, source);
        int code = connection.getResponseCode();
        if (code != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + code);
        try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
             FileOutputStream output = new FileOutputStream(target, false)) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (cancelled.contains(id)) throw new IOException("cancelled");
                output.write(buffer, 0, count);
            }
            output.getFD().sync();
        } finally {
            connection.disconnect();
        }
    }

    private HttpURLConnection openConnection(String id, String source) throws IOException {
        URL current = new URL(source);
        for (int redirect = 0; redirect < 6; redirect += 1) {
            HttpURLConnection connection = (HttpURLConnection) current.openConnection();
            connection.setConnectTimeout(60_000);
            connection.setReadTimeout(120_000);
            connection.setRequestProperty("User-Agent", "XiXiCare-Android");
            connection.setInstanceFollowRedirects(false);
            connections.put(id, connection);
            int code = connection.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null) throw new IOException("无效重定向");
                current = new URL(current, location);
                continue;
            }
            return connection;
        }
        throw new IOException("重定向次数过多");
    }

    private File fileFromPath(String path) {
        if (path.startsWith("file://")) return new File(android.net.Uri.parse(path).getPath());
        return new File(path);
    }

    @Override protected void handleOnDestroy() {
        for (HttpURLConnection connection : connections.values()) connection.disconnect();
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
