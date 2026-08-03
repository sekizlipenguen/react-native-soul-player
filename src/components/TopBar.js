import React, {useEffect, useRef} from 'react';
import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Icon, useStateWithCallback} from '../utils/Helper';
import {usePlayerSafeArea} from '../utils/safeArea';
import ChromeVignette from './ChromeVignette';

const {CastModule} = NativeModules;
const castEventEmitter = CastModule ? new NativeEventEmitter(CastModule) : null;
const CAST_SEEK_THROTTLE_MS = 1000;

const ControlButton = ({
  testID,
  accessibilityLabel,
  onPress,
  icon,
  iconSize = 22,
  iconColor,
  label,
  showLabel,
  accent,
}) => (
  <TouchableOpacity
    testID={testID}
    accessibilityLabel={accessibilityLabel || label}
    accessibilityRole="button"
    style={[styles.button, accent && styles.buttonAccent]}
    onPress={onPress}
    hitSlop={8}
  >
    <Icon name={icon} size={iconSize} color={iconColor} />
    {showLabel && label ? (
      <Text style={[styles.buttonText, {color: iconColor}]} numberOfLines={1}>
        {label}
      </Text>
    ) : null}
  </TouchableOpacity>
);

const TopBar = ({
  isPlaying,
  currentTime,
  handleSeek,
  videoUrl,
  title,
  onResetHideTimer,
  isFullscreen,
  onToggleFullscreen,
  showBack = false,
  showFullscreen = true,
  showCast = true,
  showLabels = true,
  labels = {},
  onBackButton = null,
  setIsLoading = null,
  onIsAndroidCastConnected = null,
  onTogglePlayPause,
  onCastPress,
  onCastStateChange,
  isMuted,
  volume,
  accentColor = '#F5C542',
  controlColor = '#ffffff',
}) => {
  const [isAndroidCastConnected, setIsAndroidCastConnected] = useStateWithCallback(false);
  const lastCastSeekAt = useRef(0);
  const currentTimeRef = useRef(currentTime);
  const videoUrlRef = useRef(videoUrl);
  const titleRef = useRef(title);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    videoUrlRef.current = videoUrl;
  }, [videoUrl]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const onCast = () => {
    onCastPress && onCastPress();
    if (!CastModule) {
      return;
    }
    if (Platform.OS === 'ios') {
      CastModule.showAirPlayPickerDirectly?.(() => {}, () => {});
    } else if (Platform.OS === 'android') {
      if (isAndroidCastConnected) {
        CastModule.showControllerDialog();
      } else {
        CastModule.showCastDialog();
      }
    }
  };

  // Short tap on Cast is easy to hit by mistake next to Fullscreen — require hold.
  const onCastShortPress = () => {
    if (isAndroidCastConnected) {
      onCast();
      onResetHideTimer && onResetHideTimer();
      return;
    }
    let ActionToast = null;
    try {
      ActionToast = require('@sekizlipenguen/react-native-popup-confirm-toast').ActionToast;
    } catch (_e) {
      ActionToast = null;
    }
    ActionToast?.show?.({
      title: labels.cast || 'Cast',
      message: labels.castHoldHint || 'Press and hold to cast',
      type: 'info',
      duration: 1600,
    });
    onResetHideTimer && onResetHideTimer();
  };

  useEffect(() => {
    if (Platform.OS !== 'android' || !isAndroidCastConnected || !CastModule?.seekTo) {
      return;
    }
    const now = Date.now();
    if (now - lastCastSeekAt.current < CAST_SEEK_THROTTLE_MS) {
      return;
    }
    lastCastSeekAt.current = now;
    CastModule.seekTo(currentTime);
  }, [currentTime, isAndroidCastConnected]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isAndroidCastConnected || !CastModule) {
      return;
    }
    if (isPlaying) {
      CastModule.play();
    } else {
      CastModule.pause();
    }
  }, [isPlaying, isAndroidCastConnected]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isAndroidCastConnected || !CastModule?.setVolume) {
      return;
    }
    CastModule.setVolume(isMuted ? 0 : volume).catch(() => {});
  }, [isMuted, volume, isAndroidCastConnected]);

  useEffect(() => {
    if (!castEventEmitter) {
      return undefined;
    }

    if (Platform.OS === 'ios') {
      // AirPlay routes AVPlayer itself — keep local playback running.
      // Only mirror connected UI + host callback (do not pause/mute via Android cast path).
      const onAirPlayStart = castEventEmitter.addListener('onAirPlayStart', () => {
        setIsAndroidCastConnected(true);
        onCastStateChange && onCastStateChange(true);
      });
      const onAirPlayStop = castEventEmitter.addListener('onAirPlayStop', () => {
        setIsAndroidCastConnected(false);
        onCastStateChange && onCastStateChange(false);
      });
      return () => {
        onAirPlayStart.remove();
        onAirPlayStop.remove();
      };
    }

    if (Platform.OS !== 'android') {
      return undefined;
    }

    const onSessionStartingListener = castEventEmitter.addListener('onSessionStarting', () => {
      setIsLoading && setIsLoading(true);
      setIsAndroidCastConnected(true, () => {
        onIsAndroidCastConnected && onIsAndroidCastConnected(true);
        onCastStateChange && onCastStateChange(true);
      });
    });

    const onSessionStartedListener = castEventEmitter.addListener('onSessionStarted', () => {
      onIsAndroidCastConnected && onIsAndroidCastConnected(true);
      onCastStateChange && onCastStateChange(true);
      setIsLoading && setIsLoading(false);
      if (CastModule?.playMedia) {
        CastModule.playMedia(videoUrlRef.current, titleRef.current || null, null);
        CastModule.seekTo(currentTimeRef.current);
      }
      onTogglePlayPause && onTogglePlayPause(true);
    });

    const onSessionEndedListener = castEventEmitter.addListener('onSessionEnded', () => {
      setIsLoading && setIsLoading(false);
      setIsAndroidCastConnected(false, () => {
        onIsAndroidCastConnected && onIsAndroidCastConnected(false);
        onCastStateChange && onCastStateChange(false);
      });
    });

    const onSessionEndingListener = castEventEmitter.addListener('onSessionEnding', (raw) => {
      try {
        const info = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (handleSeek && info?.currentTime) {
          handleSeek(info.currentTime);
        }
      } catch (_e) {
        // ignore
      }
    });

    return () => {
      onSessionStartingListener.remove();
      onSessionStartedListener.remove();
      onSessionEndedListener.remove();
      onSessionEndingListener.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insets = usePlayerSafeArea();
  // Content insets only — fade wrap stays full-bleed to the player edges.
  const contentPad = {
    paddingTop: isFullscreen ? Math.max(insets.top || 0, 8) + 10 : 10,
    paddingLeft: 12 + (insets.left || 0),
    paddingRight: 12 + (insets.right || 0),
  };

  return (
    <ChromeVignette
      edge="top"
      style={[styles.container, styles.topFade]}
      contentStyle={contentPad}
      pointerEvents="box-none"
    >
      <View style={styles.row} pointerEvents="box-none">
        <View style={styles.leftButtons} pointerEvents="box-none">
          {showBack ? (
            <ControlButton
              testID="soul-btn-back"
              accessibilityLabel={labels.back}
              icon="arrow-back"
              iconColor={controlColor}
              label={labels.back}
              showLabel={showLabels}
              onPress={() => {
                if (isFullscreen) {
                  onToggleFullscreen && onToggleFullscreen(false);
                }
                onBackButton && onBackButton();
              }}
            />
          ) : null}
        </View>

        <View style={styles.rightButtons} pointerEvents="box-none">
          {showFullscreen ? (
            <ControlButton
              testID="soul-btn-fullscreen"
              accessibilityLabel={isFullscreen ? labels.exitFullscreen : labels.fullscreen}
              icon={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
              iconSize={24}
              iconColor={controlColor}
              label={isFullscreen ? labels.exitFullscreen : labels.fullscreen}
              showLabel={showLabels}
              onPress={() => onToggleFullscreen && onToggleFullscreen(!isFullscreen)}
            />
          ) : null}

          {showCast && CastModule ? (
            <TouchableOpacity
              testID="soul-btn-cast"
              accessibilityLabel={isAndroidCastConnected ? labels.castStop : labels.cast}
              accessibilityRole="button"
              accessibilityHint={labels.castHoldHint}
              style={[styles.button, isAndroidCastConnected && styles.buttonAccent]}
              onPress={onCastShortPress}
              onLongPress={() => {
                onCast();
                onResetHideTimer && onResetHideTimer();
              }}
              delayLongPress={450}
              hitSlop={2}
            >
              <Icon
                name={isAndroidCastConnected ? 'cast-connected' : 'cast'}
                size={22}
                color={isAndroidCastConnected ? accentColor : controlColor}
              />
              {showLabels ? (
                <Text
                  style={[
                    styles.buttonText,
                    {color: isAndroidCastConnected ? accentColor : controlColor},
                  ]}
                  numberOfLines={1}
                >
                  {isAndroidCastConnected ? labels.castStop : labels.cast}
                </Text>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </ChromeVignette>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  // Modest fade — dark at the top edge, soft falloff (not a huge slab).
  topFade: {
    minHeight: 96,
    justifyContent: 'flex-start',
    paddingBottom: 12,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftButtons: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    gap: 6,
  },
  buttonAccent: {
    backgroundColor: 'rgba(245,197,66,0.2)',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 110,
  },
});

export default TopBar;
