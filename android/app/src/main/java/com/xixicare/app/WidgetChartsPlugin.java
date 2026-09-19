package com.xixicare.app;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;

@CapacitorPlugin(name = "WidgetCharts")
public class WidgetChartsPlugin extends Plugin {
    @PluginMethod
    public void consumeLaunchTarget(PluginCall call) {
        String target = getContext().getSharedPreferences("widget_charts", Context.MODE_PRIVATE)
            .getString("launch_target", "");
        String chartType = getContext().getSharedPreferences("widget_charts", Context.MODE_PRIVATE)
            .getString("launch_chart", "");
        String recordType = getContext().getSharedPreferences("widget_charts", Context.MODE_PRIVATE)
            .getString("launch_record_type", "");
        getContext().getSharedPreferences("widget_charts", Context.MODE_PRIVATE)
            .edit().remove("launch_target").remove("launch_chart").remove("launch_record_type").apply();
        JSObject result = new JSObject();
        result.put("target", target);
        result.put("chartType", chartType);
        result.put("recordType", recordType);
        call.resolve(result);
    }

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
