package com.babycare.app;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        JSArray urlValues = call.getArray("urls");
        JSArray idValues = call.getArray("trackIds");
        if (urlValues == null || idValues == null || urlValues.length() == 0) {
            call.reject("后台播放队列为空");
            return;
        }
        ArrayList<String> urls = new ArrayList<>();
        ArrayList<String> ids = new ArrayList<>();
        try {
            for (int index = 0; index < urlValues.length(); index += 1) urls.add(urlValues.getString(index));
            for (int index = 0; index < idValues.length(); index += 1) ids.add(idValues.getString(index));
        } catch (Exception error) {
            call.reject("后台播放队列无效", error);
            return;
        }

        Intent intent = new Intent(getContext(), BackgroundAudioService.class);
        intent.setAction(BackgroundAudioService.ACTION_START);
        intent.putStringArrayListExtra("urls", urls);
        intent.putStringArrayListExtra("ids", ids);
        intent.putExtra("index", call.getInt("index", 0));
        intent.putExtra("positionMs", call.getInt("positionMs", 0));
        intent.putExtra("loopMode", call.getString("loopMode", "list"));
        intent.putExtra("volume", call.getFloat("volume", 0.45f));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
        else getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        JSObject result = BackgroundAudioService.snapshot();
        Intent intent = new Intent(getContext(), BackgroundAudioService.class);
        intent.setAction(BackgroundAudioService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve(result);
    }
}
