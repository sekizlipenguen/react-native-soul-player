package com.sekizlipenguen.soulplayer;

import android.app.Activity;
import android.view.Window;
import android.view.WindowManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.UiThreadUtil;

import javax.annotation.Nonnull;

public class SoulBrightnessModule extends ReactContextBaseJavaModule {

    public SoulBrightnessModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Nonnull
    @Override
    public String getName() {
        return "SoulBrightnessModule";
    }

    @ReactMethod
    public void setBrightnessLevel(double level) {
        final float value = (float) Math.max(0.0, Math.min(1.0, level));
        UiThreadUtil.runOnUiThread(() -> {
            Activity activity = getCurrentActivity();
            if (activity == null || activity.isFinishing()) {
                return;
            }
            Window window = activity.getWindow();
            if (window == null) {
                return;
            }
            WindowManager.LayoutParams attrs = window.getAttributes();
            attrs.screenBrightness = value;
            window.setAttributes(attrs);
        });
    }

    @ReactMethod
    public void getBrightnessLevel(Promise promise) {
        UiThreadUtil.runOnUiThread(() -> {
            Activity activity = getCurrentActivity();
            if (activity == null) {
                promise.resolve(0.5);
                return;
            }
            Window window = activity.getWindow();
            if (window == null) {
                promise.resolve(0.5);
                return;
            }
            float brightness = window.getAttributes().screenBrightness;
            if (brightness < 0f) {
                // Negative means system default — expose a mid value.
                promise.resolve(0.5);
                return;
            }
            promise.resolve((double) brightness);
        });
    }
}
