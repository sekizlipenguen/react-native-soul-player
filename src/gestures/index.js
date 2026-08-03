import {NativeModules} from 'react-native';

/**
 * Surface gesture helpers (swipe volume / brightness, tap zones).
 */

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Left half = brightness, right half = volume (YouTube-style). */
export const resolveSwipeZone = (x, width) => {
  if (!width || x == null) {
    return 'volume';
  }
  return x < width / 2 ? 'brightness' : 'volume';
};

/** Vertical drag: up increases, down decreases. */
export const applyVerticalSwipe = (startValue, dy, height, sensitivity = 1) => {
  const span = Math.max(height || 1, 1);
  const delta = (-dy / span) * sensitivity;
  return clamp((startValue ?? 0) + delta, 0, 1);
};

export const resolveDoubleTapZone = (x, width) => {
  if (!width || x == null) {
    return 'center';
  }
  const third = width / 3;
  if (x < third) {
    return 'left';
  }
  if (x > third * 2) {
    return 'right';
  }
  return 'center';
};

const brightnessMod =
  NativeModules.SoulBrightnessModule || NativeModules.ScreenBrightness || null;

/** Uses built-in SoulBrightnessModule (falls back to ScreenBrightness if present). */
export const setSystemBrightness = (level) => {
  if (!brightnessMod) {
    return false;
  }
  const value = clamp(level, 0, 1);
  try {
    if (brightnessMod.setBrightnessLevel) {
      brightnessMod.setBrightnessLevel(value);
      return true;
    }
    if (brightnessMod.setBrightness) {
      brightnessMod.setBrightness(value);
      return true;
    }
  } catch (_e) {
    return false;
  }
  return false;
};

export const canControlBrightness = () =>
  !!(brightnessMod?.setBrightnessLevel || brightnessMod?.setBrightness);
