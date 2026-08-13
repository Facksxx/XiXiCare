package com.xixicare.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackNavigation")
public class BackNavigationPlugin extends Plugin {
    private static volatile BackNavigationPlugin instance;
    private static volatile boolean intercepting;

    @Override public void load() { instance = this; }

    @PluginMethod
    public void setIntercepting(PluginCall call) {
        intercepting = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        call.resolve();
    }

    public static boolean dispatchBack() {
        BackNavigationPlugin plugin = instance;
        if (!intercepting || plugin == null) return false;
        plugin.notifyListeners("backPressed", new JSObject());
        return true;
    }

    @Override protected void handleOnDestroy() {
        instance = null;
        intercepting = false;
        super.handleOnDestroy();
    }
}
