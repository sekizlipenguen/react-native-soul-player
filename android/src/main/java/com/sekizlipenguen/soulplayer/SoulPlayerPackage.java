package com.sekizlipenguen.soulplayer;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import com.sekizlipenguen.soulplayer.cast.MediaRouteButtonManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SoulPlayerPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new CastModule(reactContext));
        modules.add(new SoulOrientationModule(reactContext));
        modules.add(new SoulBrightnessModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        List<ViewManager> viewManagers = new ArrayList<>();
        viewManagers.add(new MediaRouteButtonManager()); // MediaRouteButtonManager ekleniyor
        return viewManagers;
    }
}
