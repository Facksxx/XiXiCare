package com.xixicare.app;

import android.content.Intent;
import android.os.Bundle;
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
        super.onCreate(savedInstanceState);
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
