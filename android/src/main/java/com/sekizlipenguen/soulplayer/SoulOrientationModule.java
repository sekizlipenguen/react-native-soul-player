package com.sekizlipenguen.soulplayer;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;

import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class SoulOrientationModule extends ReactContextBaseJavaModule {
    private Activity activity;
    private static final String TAG = "SoulOrientationModule";

    public SoulOrientationModule(ReactApplicationContext reactContext) {
        super(reactContext);

        if (BuildConfig.DEBUG) {
            Log.d(TAG, "Constructor initialized");
        }

        // LifecycleEventListener ile Activity referansını güncel tut
        reactContext.addLifecycleEventListener(new LifecycleEventListener() {
            @Override
            public void onHostResume() {
                activity = reactContext.getCurrentActivity(); // Resume sırasında Activity'yi al
                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "onHostResume: Activity updated");
                }
            }

            @Override
            public void onHostPause() {
                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "onHostPause: Activity paused");
                }
            }

            @Override
            public void onHostDestroy() {
                activity = null; // Activity yok edildiğinde temizle
                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "onHostDestroy: Activity set to null");
                }
            }
        });
    }

    @Override
    public String getName() {
        if (BuildConfig.DEBUG) {
            Log.d(TAG, "getName called");
        }
        return "SoulOrientationModule"; // React Native'de kullanılacak benzersiz isim
    }

    @ReactMethod
    public void lockToPortrait() {
        if (activity != null) {
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "lockToPortrait called and executed successfully");
            }
        } else {
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "lockToPortrait: Activity is null");
            }
        }
    }

    @ReactMethod
    public void lockToLandscape() {
        if (BuildConfig.DEBUG) {
            Log.d(TAG, "lockToLandscape called");
        }
        if (activity != null) {
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "lockToLandscape executed successfully");
            }
        } else {
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "lockToLandscape: Activity is null");
            }
        }
    }

    @ReactMethod
    public void unlockAllOrientations() {
        if (activity != null) {
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "unlockAllOrientations called and executed successfully");
            }
        } else {
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "unlockAllOrientations: Activity is null");
            }
        }
    }

    /**
     * Sticky-immersive system bars (status + nav). Devices with a 3-button / gesture
     * nav bar otherwise paint player chrome underneath that inset.
     */
    @ReactMethod
    public void setImmersiveMode(boolean enabled) {
        final Activity current = activity != null ? activity : getCurrentActivity();
        if (current == null) {
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "setImmersiveMode: Activity is null");
            }
            return;
        }
        current.runOnUiThread(() -> {
            Window window = current.getWindow();
            if (window == null) {
                return;
            }
            View decor = window.getDecorView();
            if (enabled) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsController controller = window.getInsetsController();
                    if (controller != null) {
                        controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                        controller.setSystemBarsBehavior(
                                WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    }
                } else {
                    //noinspection deprecation
                    decor.setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_FULLSCREEN);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = window.getInsetsController();
                if (controller != null) {
                    controller.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                }
            } else {
                //noinspection deprecation
                decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
            }
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "setImmersiveMode: " + enabled);
            }
        });
    }
}
