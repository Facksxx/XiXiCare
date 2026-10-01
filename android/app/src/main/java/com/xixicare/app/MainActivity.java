package com.xixicare.app;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(BackgroundAudioPlugin.class);
        registerPlugin(SoundDownloadPlugin.class);
        registerPlugin(BackNavigationPlugin.class);
        registerPlugin(WidgetChartsPlugin.class);
        registerPlugin(PrivacyActionsPlugin.class);
        registerPlugin(SystemThemePlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
            bridge.getWebView().setVerticalScrollBarEnabled(false);
        }
        handleWidgetIntent(getIntent());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (BackNavigationPlugin.dispatchBack()) return;
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWidgetIntent(intent);
    }

    /** 系统深浅色切换时（uiMode 已在 configChanges 中，Activity 不重建）主动通知 Web 端。 */
    @Override
    protected void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (bridge == null) return;
        String theme = SystemThemePlugin.isDark(this) ? "dark" : "light";
        bridge.triggerWindowJSEvent("xixicareSystemTheme", "{\"theme\":\"" + theme + "\"}");
    }

    private void handleWidgetIntent(Intent intent) {
        if (intent == null) return;
        String target = intent.getStringExtra("target");
        if (!"stats".equals(target) && !"dashboard".equals(target)) return;
        String chartType = intent.getStringExtra("chartType");
        if (chartType == null) chartType = "milk";
        String recordType = intent.getStringExtra("recordType");
        if (recordType == null) recordType = "feeding";
        getSharedPreferences("widget_charts", MODE_PRIVATE).edit()
            .putString("launch_target", target)
            .putString("launch_chart", chartType)
            .putString("launch_record_type", recordType)
            .apply();
        if (bridge != null) bridge.triggerWindowJSEvent("xixicareWidgetOpen",
            "{\"target\":\"" + target + "\",\"chartType\":\"" + chartType
                + "\",\"recordType\":\"" + recordType + "\"}");
    }

}
