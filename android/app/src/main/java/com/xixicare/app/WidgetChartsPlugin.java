package com.xixicare.app;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;

@CapacitorPlugin(name = "WidgetCharts")
public class WidgetChartsPlugin extends Plugin {
    @PluginMethod
    public void updateSnapshot(PluginCall call) {
        String daily = call.getString("daily", "[]");
        if (daily.length() > 8192) { call.reject("图表数据过长"); return; }
        try { new JSONArray(daily); }
        catch (Exception error) { call.reject("图表数据无效", error); return; }
        getContext().getSharedPreferences("widget_charts", Context.MODE_PRIVATE).edit().putString("daily", daily).apply();
        FormulaWidgetProvider.refreshAll(getContext());
        call.resolve();
    }
}
