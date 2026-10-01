package com.xixicare.app;

import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 读取系统深浅色，并把 App 当前主题同步到状态栏 / 导航栏外观。
 * 安卓 WebView 的 prefers-color-scheme 在部分机型和主题配置下恒为浅色，因此以原生 uiMode 为准。
 */
@CapacitorPlugin(name = "SystemTheme")
public class SystemThemePlugin extends Plugin {
    private static final String DARK_BAR = "#0D0C0B";
    private static final String LIGHT_BAR = "#FDFCFB";

    public static boolean isDark(Context context) {
        int mode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    @PluginMethod
    public void getSystemTheme(PluginCall call) {
        JSObject result = new JSObject();
        result.put("dark", isDark(getContext()));
        call.resolve(result);
    }

    /** 由 Web 端在主题（含手动切换）变化时调用，保证系统栏图标与 App 内主题一致。 */
    @PluginMethod
    public void setDarkMode(PluginCall call) {
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                Window window = activity.getWindow();
                window.setNavigationBarColor(Color.parseColor(dark ? DARK_BAR : LIGHT_BAR));
                View decor = window.getDecorView();
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decor);
                if (controller != null) {
                    controller.setAppearanceLightStatusBars(!dark);
                    controller.setAppearanceLightNavigationBars(!dark);
                }
            });
        }
        call.resolve();
    }
}
