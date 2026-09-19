package com.xixicare.app;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PrivacyActions")
public class PrivacyActionsPlugin extends Plugin {
    private static final String POLICY_URL = "https://swsdl.vivo.com.cn/appstore/developer/privacy-policy/6febf0ab5b07441497d22be1c53f248c.html";

    @PluginMethod
    public void openPolicy(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(POLICY_URL));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("无法打开隐私政策", error);
        }
    }

    @PluginMethod
    public void exitApp(PluginCall call) {
        call.resolve();
        getActivity().runOnUiThread(() -> getActivity().finishAffinity());
    }
}
