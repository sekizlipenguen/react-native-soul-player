# Soul Player Example (RN 0.86.2)

Playground for [`@sekizlipenguen/react-native-soul-player`](../README.md). Not published to npm.

## Setup

```bash
yarn
cd ios && pod install && cd ..
```

Requires **Node ≥ 22.11**.

App tree: `SafeAreaProvider` → popup `Root` → `SafeAreaView` → scrollable demo → mid **16:9** `SoulPlayer` → probe text below.

## Run

```bash
yarn start --port 8081
yarn android
# or
yarn ios
```

`yarn android` runs `adb reverse` for Metro on 8081.

## Defaults

- Ads **OFF** (toggle **Ads ON** for preroll pod → mid @10s → mid @45s → postroll)
- `resizeMode="cover"`
- Debug overlay off
- Player in a fixed 16:9 box (not `flex:1` full bleed) so bottom chrome bugs aren’t confused with SafeArea / gesture insets

## iOS orientation (fullscreen)

Example `Info.plist` lists portrait + landscape. `AppDelegate` returns `SoulPlayerGetOrientationMask()` so immersive FS can lock landscape. Host apps must do the same (see root README).

## Android PiP

Example `AndroidManifest.xml` already sets `supportsPictureInPicture` + `resizeableActivity` on `MainActivity`.
