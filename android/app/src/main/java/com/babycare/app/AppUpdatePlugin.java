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

import java.io.File;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
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

        Uri sourceUri = Uri.parse(rawPath);
        File apkFile = "file".equals(sourceUri.getScheme())
                ? new File(sourceUri.getPath())
                : new File(rawPath);
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
}
