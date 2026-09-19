package com.xixicare.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
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
        getContext().getSharedPreferences("widget_charts", Context.MODE_PRIVATE)
            .edit().remove("launch_target").remove("launch_chart").apply();
        JSObject result = new JSObject();
        result.put("target", target);
        result.put("chartType", chartType);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPinWidget(PluginCall call) {
        String kind = call.getString("kind", "native");
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            result.put("supported", false);
            result.put("requested", false);
            call.resolve(result);
            return;
        }
        AppWidgetManager manager = getContext().getSystemService(AppWidgetManager.class);
        boolean supported = manager != null && manager.isRequestPinAppWidgetSupported();
        boolean requested = false;
        if (supported) {
            Class<?> providerClass = "vivo".equals(kind)
                ? FormulaWidgetProvider.class
                : NativeFormulaWidgetProvider.class;
            ComponentName provider = new ComponentName(getContext(), providerClass);
            requested = manager.requestPinAppWidget(provider, null, null);
        }
        result.put("supported", supported);
        result.put("requested", requested);
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
