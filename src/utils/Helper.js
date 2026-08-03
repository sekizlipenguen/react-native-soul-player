import {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Image, Platform, StatusBar} from 'react-native';

export function useStateWithCallback(initialValue) {
  const [state, setState] = useState(initialValue);
  const callbackRef = useRef(null);

  // Must be stable — otherwise consumers that depend on the setter (e.g. auto-hide
  // timer) recreate callbacks every render and clear timeouts on each onProgress tick.
  const setStateWithCallback = useCallback((value, callback) => {
    callbackRef.current = typeof callback === 'function' ? callback : null;
    setState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (Object.is(next, prev)) {
        // No-op update: drop callback. Flushing it can re-enter setState loops
        // when callers chain onPlay/onPause → parent setState → remount Video.
        callbackRef.current = null;
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const cb = callbackRef.current;
    if (!cb) {
      return;
    }
    // Clear before invoke to prevent re-entrant max-update-depth loops.
    callbackRef.current = null;
    cb(state);
  }, [state]);

  return [state, setStateWithCallback];
}

export function getStatusBarHeight(skipAndroid = false) {
  if (Platform.OS === 'ios') {
    // Prefer safe-area when host provides it; fall back to a notch-friendly default.
    return 47;
  }
  return skipAndroid ? 0 : StatusBar.currentHeight || 0;
}

export const fadeIn = (animatedValue, duration = 300) => {
  Animated.timing(animatedValue, {
    toValue: 1,
    duration,
    useNativeDriver: true,
  }).start();
};

export const fadeOut = (animatedValue, onComplete, duration = 300) => {
  Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    useNativeDriver: true,
  }).start(() => {
    if (onComplete) {
      onComplete();
    }
  });
};

export const Icon = ({name, size = 30, color}) => {
  const iconMap = {
    'arrow-back': require('../styles/icons/arrow_back.png'),
    fullscreen: require('../styles/icons/fullscreen.png'),
    'fullscreen-exit': require('../styles/icons/fullscreen_exit.png'),
    cast: require('../styles/icons/cast.png'),
    'cast-connected': require('../styles/icons/cast_connected.png'),
    'volume-off': require('../styles/icons/volume_of.png'),
    'volume-up': require('../styles/icons/volume_up.png'),
    'replay-10': require('../styles/icons/replay_10.png'),
    'forward-10': require('../styles/icons/forward_10.png'),
    pause: require('../styles/icons/pause.png'),
    'pause-circle': require('../styles/icons/pause_circle.png'),
    'play-arrow': require('../styles/icons/play_arrow.png'),
    settings: require('../styles/icons/settings.png'),
  };

  const iconSource = iconMap[name];

  if (!iconSource) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return (
    <Image
      source={iconSource}
      style={{
        width: size,
        height: size,
        tintColor: color,
      }}
      resizeMode="contain"
    />
  );
};
