import React, {forwardRef, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  NativeModules,
  PanResponder,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Video from 'react-native-video';

import {mergeControls} from '../defaults/controls';
import {
  applyVerticalSwipe,
  resolveSwipeZone,
  setSystemBrightness,
} from '../gestures';
import {formatLabel, isRtlLocale, resolveLabels} from '../i18n';
import {
  canSkipAd,
  findBreaksInSeekRange,
  findCrossedBreak,
  getBreakId,
  pickCreatives,
  skipCountdownSeconds,
} from '../ads/AdController';
import {fetchVast} from '../ads/Vast';
import {Icon} from '../utils/Helper';
import {PlayerSafeAreaProvider, usePlayerSafeArea} from '../utils/safeArea';
import AdOverlay from './AdOverlay';
import ChromeVignette from './ChromeVignette';
import EndScreen from './EndScreen';
import LiveBadge from './LiveBadge';
import ProgressBar from './ProgressBar';
import SettingsMenu, {
  closeSettingsSheet,
  openSettingsSheet,
  resolveSheetHeight,
} from './SettingsMenu';
import TopBar from './TopBar';

let ActionToast = null;
try {
  ActionToast = require('@sekizlipenguen/react-native-popup-confirm-toast').ActionToast;
} catch (_e) {
  ActionToast = null;
}

const SLEEP_OPTIONS_MIN = [0, 5, 15, 30];

const {SoulOrientationModule} = NativeModules;
const platform = Platform.OS;

const DEFAULT_THEME = {
  accentColor: '#F5C542',
  trackColor: '#666666',
  controlColor: '#ffffff',
};

const DOUBLE_TAP_MS = 260;

const SoulPlayer = forwardRef((props, ref) => {
  const {
    videoUrl,
    videoType,
    title,
    description,
    poster,
    paused,
    resizeMode: resizeModeProp = 'cover',
    theme,
    style,
    videoProps,
    controls: controlsProp,
    labels: labelsProp,
    locale = 'auto',
    showBackButton = false,
    showCastButton = true,
    fullscreenMode = 'immersive',
    enterFullscreenOnRotate = true,
    exitFullscreenOnPortrait = true,
    textTracks: externalTextTracks,
    ads,
    chapters = [],
    endScreenItems = [],
    resumeTime,
    startTime,
    isLive: isLiveProp = false,
    isOffline = false,
    preset,
    holdRate,
    renderTopBar,
    renderBottomBar,
    renderAdOverlay,
    renderEndScreen,
    renderCompanion,
    onLoadStart,
    onError,
    onEnd,
    onSeek,
    onProgress,
    onLoad,
    onMuteToggle,
    onVolumeChange,
    onQualityChange,
    onAudioTrackChange,
    onSubtitleChange,
    onFullScreen,
    onFullScreenEnter,
    onFullScreenExit,
    onPlay,
    onPause,
    onBackButton,
    onRewind,
    onForward,
    onSettingsOpen,
    onSettingsClose,
    onCastPress,
    onCastStateChange,
    onControlsVisibilityChange,
    onNext,
    onPrevious,
    onEndScreenAction,
    onShare,
    onAdBreakStart,
    onAdBreakEnd,
    onAdSkip,
    onAdClick,
    onAdError,
    onProgressPersist,
  } = props;

  const controls = useMemo(() => {
    const base = mergeControls(controlsProp, {showBackButton, showCastButton});
    if (preset === 'minimal') {
      return {
        ...base,
        showLabels: false,
        cast: false,
        settings: false,
        rewind: false,
        forward: false,
        doubleTapSeek: false,
        swipeBrightness: false,
      };
    }
    if (preset === 'youtube') {
      return {...base, showLabels: false, doubleTapSeek: true, holdToSpeed: true};
    }
    if (preset === 'tv') {
      return {...base, showLabels: true, swipeVolume: false, swipeBrightness: false};
    }
    return base;
  }, [controlsProp, showBackButton, showCastButton, preset]);

  const labels = useMemo(
    () => resolveLabels(locale, labelsProp),
    [locale, labelsProp],
  );
  const rtl = isRtlLocale(locale);
  const colors = useMemo(() => ({...DEFAULT_THEME, ...(theme || {})}), [theme]);
  const seekStep = controls.seekStep || 10;
  // Opt-in: ads only run when `enabled: true` and at least one break is configured.
  const adsEnabled = !!(ads && ads.enabled === true && ads.breaks?.length);

  const videoRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const volumeIconRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const showControlsRef = useRef(true);
  const fadeGenRef = useRef(0);
  const isScrubbingRef = useRef(false);
  const hideControlsNowRef = useRef(() => {});
  const showControlsNowRef = useRef(() => {});
  const lastTapRef = useRef({time: 0, x: 0});
  const singleTapTimerRef = useRef(null);
  const holdBaseRateRef = useRef(1);
  const playedAdIdsRef = useRef(new Set());
  const contentTimeBeforeAdRef = useRef(0);
  const pendingSeekAfterAdsRef = useRef(null);
  const adQueueRef = useRef([]);
  const isAdPlayingRef = useRef(false);
  const adStartingRef = useRef(false);
  const adCurrentTimeRef = useRef(0);
  const activeAdRef = useRef(null);
  const lastContentTimeRef = useRef(0);
  const orientationLockedRef = useRef(false);
  const holdTimerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(!paused);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isVolumeBarVisible, setIsVolumeBarVisible] = useState(false);
  const [volumeBarPosition, setVolumeBarPosition] = useState({left: 0, bottom: 0});
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Immersive FS already uses RN Modal — SPSheet (another Modal) often mounts empty.
  // Host settings in a sibling Modal instead (same pattern as ad/lock overlays).
  const [settingsSession, setSettingsSession] = useState(null);
  const [selectedMaxBitRate, setSelectedMaxBitRate] = useState(0);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
  const [selectedTextTrack, setSelectedTextTrack] = useState(null);
  const [audioTracks, setAudioTracks] = useState([]);
  const [textTracks, setTextTracks] = useState([]);
  const [key, setKey] = useState(0);
  const [isAndroidCastConnected, setIsAndroidCastConnected] = useState(false);
  const [resizeMode, setResizeMode] = useState(resizeModeProp);
  const [subtitleStyle, setSubtitleStyle] = useState({fontSize: 18});
  const [playbackError, setPlaybackError] = useState(null);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [seekHint, setSeekHint] = useState(null);
  const [activeAd, setActiveAd] = useState(null);
  const [adCreativeIndex, setAdCreativeIndex] = useState(0);
  const [adCreatives, setAdCreatives] = useState([]);
  const [adCurrentTime, setAdCurrentTime] = useState(0);
  const [adDuration, setAdDuration] = useState(0);
  const [adWallElapsed, setAdWallElapsed] = useState(0);
  const adWallStartRef = useRef(0);
  const [surfaceSize, setSurfaceSize] = useState({width: 1, height: 1});
  const [playerWindow, setPlayerWindow] = useState({x: 0, y: 0, width: 0, height: 0});
  const playerHostRef = useRef(null);
  const [isLocked, setIsLocked] = useState(false);
  const [swipeHud, setSwipeHud] = useState(null);
  const [brightness, setBrightness] = useState(0.7);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepEndsAt, setSleepEndsAt] = useState(null);
  const [adDeliveryMode, setAdDeliveryMode] = useState('single');
  const [isInPip, setIsInPip] = useState(false);
  const swipeStartRef = useRef(null);
  const playNextCreativeOrEndRef = useRef(null);
  const skipAdBreakRef = useRef(null);
  const progressUiScheduledRef = useRef(false);

  const isAdPlaying = !!activeAd;
  const currentCreative = adCreatives[adCreativeIndex];
  const drmActive = !!(controls.drmStatus && (videoProps?.drm || videoProps?.drm?.type));

  useEffect(() => {
    isAdPlayingRef.current = isAdPlaying;
  }, [isAdPlaying]);

  useEffect(() => {
    adCurrentTimeRef.current = adCurrentTime;
  }, [adCurrentTime]);

  useEffect(() => {
    activeAdRef.current = activeAd;
  }, [activeAd]);

  useEffect(() => {
    showControlsRef.current = showControls;
    onControlsVisibilityChange && onControlsVisibilityChange(showControls);
  }, [showControls, onControlsVisibilityChange]);

  useEffect(() => {
    setResizeMode(resizeModeProp);
  }, [resizeModeProp]);

  useEffect(() => {
    if (typeof paused !== 'boolean') {
      return;
    }
    const shouldPlay = !paused;
    setIsPlaying((prev) => (prev === shouldPlay ? prev : shouldPlay));
    // Parent paused prop sync only — do not fire onPlay/onPause here (host owns that).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Hide only while content is playing — keep chrome up when paused (YouTube-like).
  const autoHideEnabled = controls.autoHide !== false && !isAdPlaying && isPlaying;
  const autoHideDelayMs = controls.autoHideDelay || 3000;

  const resetHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (!autoHideEnabled || isScrubbingRef.current) {
      return;
    }
    hideTimeoutRef.current = setTimeout(() => {
      hideTimeoutRef.current = null;
      if (!showControlsRef.current || isScrubbingRef.current) {
        return;
      }
      hideControlsNowRef.current?.();
    }, autoHideDelayMs);
  }, [autoHideEnabled, autoHideDelayMs]);

  // Immersive Modal remounts the player tree; native-driver opacity often sticks at 0
  // so chrome never reappears until we hard-reset the animated value.
  const forceChromeVisible = useCallback(() => {
    fadeGenRef.current += 1;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    fadeAnim.stopAnimation?.();
    fadeAnim.setValue(1);
    showControlsRef.current = true;
    setShowControls(true);
    resetHideTimer();
  }, [fadeAnim, resetHideTimer, setShowControls]);

  // Start / restart auto-hide only when the policy changes — not on every progress tick.
  useEffect(() => {
    if (autoHideEnabled && showControlsRef.current && !isScrubbingRef.current) {
      resetHideTimer();
    }
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [autoHideEnabled, autoHideDelayMs, resetHideTimer]);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  const setFullscreenState = useCallback(
    (next) => {
      if (next === isFullscreen) {
        return;
      }
      StatusBar.setHidden(next, 'slide');
      if (SoulOrientationModule) {
        if (next) {
          SoulOrientationModule.lockToLandscape?.();
          SoulOrientationModule.setImmersiveMode?.(true);
          orientationLockedRef.current = true;
        } else {
          SoulOrientationModule.setImmersiveMode?.(false);
          SoulOrientationModule.lockToPortrait?.();
          orientationLockedRef.current = false;
        }
      }
      setIsFullscreen(next);
      onFullScreen && onFullScreen(next);
      if (next) {
        onFullScreenEnter && onFullScreenEnter();
        // Modal hasn't mounted yet — onShow / effect will hard-show chrome.
      } else {
        onFullScreenExit && onFullScreenExit();
        // Restore chrome when leaving immersive too (same remount path).
        requestAnimationFrame(() => forceChromeVisible());
      }
    },
    [
      isFullscreen,
      onFullScreen,
      onFullScreenEnter,
      onFullScreenExit,
      forceChromeVisible,
    ],
  );

  useEffect(() => {
    if (!isFullscreen) {
      return undefined;
    }
    // After immersive Modal mounts, rebind opacity (native driver + tree move).
    const t1 = requestAnimationFrame(() => forceChromeVisible());
    const t2 = setTimeout(() => forceChromeVisible(), 80);
    const t3 = setTimeout(() => forceChromeVisible(), 320);
    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isFullscreen, forceChromeVisible]);

  useEffect(() => {
    if (!enterFullscreenOnRotate && !exitFullscreenOnPortrait) {
      return undefined;
    }
    const onChange = ({window}) => {
      const landscape = window.width > window.height;
      if (landscape && enterFullscreenOnRotate) {
        setFullscreenState(true);
        return;
      }
      // Don't auto-exit while we locked landscape via the fullscreen button —
      // Dimensions can briefly report portrait during the rotate animation.
      if (
        !landscape &&
        exitFullscreenOnPortrait &&
        isFullscreen &&
        !orientationLockedRef.current
      ) {
        setFullscreenState(false);
      }
    };
    const sub = Dimensions.addEventListener('change', onChange);
    return () => sub?.remove?.();
  }, [
    enterFullscreenOnRotate,
    exitFullscreenOnPortrait,
    isFullscreen,
    setFullscreenState,
  ]);

  const togglePlayPause = (paramStatus = null) => {
    if (isAdPlaying) {
      return;
    }
    const newPlayingState = paramStatus === null ? !isPlaying : paramStatus;
    resetHideTimer();
    setIsPlaying(newPlayingState);
    if (newPlayingState && onPlay) {
      onPlay(currentTime);
    } else if (!newPlayingState && onPause) {
      onPause(currentTime);
    }
  };

  const toggleMute = () => {
    resetHideTimer();
    const next = !isMuted;
    setIsMuted(next);
    onMuteToggle && onMuteToggle(next);
  };

  const formatTime = (time) => {
    const safe = Number.isFinite(time) ? Math.max(0, time) : 0;
    const minutes = Math.floor(safe / 60);
    const seconds = Math.floor(safe % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const applyContentSeek = (next, meta) => {
    const clamped = Math.max(0, Math.min(duration || next, next));
    if (videoRef.current?.seek) {
      videoRef.current.seek(clamped);
    }
    setCurrentTime(clamped);
    lastContentTimeRef.current = clamped;
    // Scrub/seek must never leave chrome stuck invisible (fade race).
    showControlsNowRef.current?.();
    onSeek && onSeek(clamped);
    if (meta === 'rewind') {
      onRewind && onRewind(clamped);
    }
    if (meta === 'forward') {
      onForward && onForward(clamped);
    }
    return clamped;
  };

  const handleSeek = (value, meta) => {
    if (isAdPlayingRef.current || adStartingRef.current) {
      return;
    }
    const from = lastContentTimeRef.current || currentTime;
    const next = Math.max(0, Math.min(duration || value, value));

    // Seeking forward across unwatched midrolls → play ads first, then land on target.
    if (adsEnabled && duration && next > from + 0.05) {
      const blocking = findBreaksInSeekRange(
        ads.breaks,
        from,
        next,
        duration,
        playedAdIdsRef.current,
      );
      if (blocking.length) {
        pendingSeekAfterAdsRef.current = next;
        adQueueRef.current = blocking.slice(1);
        const first = blocking[0];
        // Park playhead at cue so content doesn't jump past the break.
        if (videoRef.current?.seek) {
          videoRef.current.seek(first.cueAt);
        }
        setCurrentTime(first.cueAt);
        lastContentTimeRef.current = first.cueAt;
        setIsPlaying(false);
        startAdBreak(first, {resumeAt: next});
        return;
      }

      // Seek-to-end should still deliver an unwatched postroll.
      if (next >= duration - 0.35) {
        const postroll = ads.breaks.find((b) => b.position === 'postroll');
        const postId = postroll ? getBreakId(postroll) : null;
        if (postroll && postId && !playedAdIdsRef.current.has(postId)) {
          pendingSeekAfterAdsRef.current = duration;
          setIsPlaying(false);
          startAdBreak({...postroll, id: postId}, {resumeAt: duration});
          return;
        }
      }
    }

    applyContentSeek(next, meta);
  };

  React.useImperativeHandle(ref, () => ({
    getInfo: () => ({duration, currentTime, isFullscreen, isAdPlaying}),
    videoRef: () => videoRef.current,
    seek: (time) => handleSeek(time),
    enterFullscreen: () => setFullscreenState(true),
    exitFullscreen: () => setFullscreenState(false),
    showChrome: () => forceChromeVisible(),
    hideChrome: () => hideControlsNowRef.current?.(),
  }));

  const showControlsNow = () => {
    const gen = ++fadeGenRef.current;
    showControlsRef.current = true;
    setShowControls(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    // Hard-reset first: after Modal remount / hide, native-driver opacity can stick at 0
    // and a bare timing() never paints icons even though React state says "shown".
    fadeAnim.stopAnimation?.();
    fadeAnim.setValue(1);
    resetHideTimer();
    // Keep a short fade for subsequent show↔hide; value is already 1 so this is a no-op paint.
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (!finished || gen !== fadeGenRef.current) {
        return;
      }
      resetHideTimer();
    });
  };
  showControlsNowRef.current = showControlsNow;

  const hideControlsNow = () => {
    const gen = ++fadeGenRef.current;
    showControlsRef.current = false;
    // Drop hit-targets immediately so the reveal catcher can receive the next tap
    // while opacity is still animating out (otherwise invisible chrome eats presses).
    setShowControls(false);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    fadeAnim.stopAnimation?.();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (!finished || gen !== fadeGenRef.current) {
        return;
      }
      if (!showControlsRef.current) {
        fadeAnim.setValue(0);
      }
    });
  };
  hideControlsNowRef.current = hideControlsNow;

  const handleSurfacePress = (evt) => {
    if (isAdPlaying || isLocked) {
      return;
    }
    // Chrome hidden → reveal immediately (no double-tap delay). Exo TextureView
    // often sits above the mid-gesture layer; the catch-all overlay uses this too.
    if (!showControlsRef.current) {
      if (controls.singleTapToggleControls !== false) {
        forceChromeVisible();
      }
      lastTapRef.current = {time: 0, x: 0};
      return;
    }

    const {locationX} = evt.nativeEvent;
    const now = Date.now();
    const width = surfaceSize.width || 1;
    const isDouble =
      now - lastTapRef.current.time < DOUBLE_TAP_MS &&
      Math.abs(locationX - lastTapRef.current.x) < width * 0.35;

    if (isDouble) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = {time: 0, x: 0};
      const third = width / 3;
      if (controls.doubleTapSeek && locationX < third) {
        const next = Math.max(0, currentTime - seekStep);
        handleSeek(next, 'rewind');
        setSeekHint(`-${seekStep}s`);
        setTimeout(() => setSeekHint(null), 700);
        return;
      }
      if (controls.doubleTapSeek && locationX > third * 2) {
        const max = duration > 0 ? duration : currentTime + seekStep;
        const next = Math.min(max, currentTime + seekStep);
        handleSeek(next, 'forward');
        setSeekHint(`+${seekStep}s`);
        setTimeout(() => setSeekHint(null), 700);
        return;
      }
      if (controls.doubleTapPlayPause) {
        togglePlayPause();
      }
      return;
    }

    lastTapRef.current = {time: now, x: locationX};
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }
    singleTapTimerRef.current = setTimeout(() => {
      singleTapTimerRef.current = null;
      if (!controls.singleTapToggleControls) {
        return;
      }
      if (isVolumeBarVisible) {
        setIsVolumeBarVisible(false);
        return;
      }
      if (showControlsRef.current) {
        hideControlsNow();
      } else {
        forceChromeVisible();
      }
    }, DOUBLE_TAP_MS);
  };

  // Only claim the gesture on vertical move — never on touch start.
  // (Claiming on start stole taps from bottom chrome when insets were tight.)
  const surfacePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          !isAdPlaying &&
          !isLocked &&
          (controls.swipeVolume || controls.swipeBrightness) &&
          Math.abs(g.dy) > 12 &&
          Math.abs(g.dy) > Math.abs(g.dx) * 1.15,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          !isAdPlaying &&
          !isLocked &&
          (controls.swipeVolume || controls.swipeBrightness) &&
          Math.abs(g.dy) > 12 &&
          Math.abs(g.dy) > Math.abs(g.dx) * 1.15,
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: (evt) => {
          const {locationX, locationY} = evt.nativeEvent;
          swipeStartRef.current = {
            x: locationX,
            y: locationY,
            volume,
            brightness,
            zone: resolveSwipeZone(locationX, surfaceSize.width),
          };
        },
        onPanResponderMove: (_evt, g) => {
          const start = swipeStartRef.current;
          if (!start || isLocked || isAdPlaying) {
            return;
          }
          if (start.zone === 'volume' && controls.swipeVolume) {
            const next = applyVerticalSwipe(start.volume, g.dy, surfaceSize.height);
            setVolume(next);
            setIsMuted(next <= 0.01);
            onVolumeChange && onVolumeChange(next);
            setSwipeHud({type: 'volume', value: next});
          } else if (start.zone === 'brightness' && controls.swipeBrightness) {
            const next = applyVerticalSwipe(start.brightness, g.dy, surfaceSize.height);
            setBrightness(next);
            setSystemBrightness(next);
            setSwipeHud({type: 'brightness', value: next});
          }
        },
        onPanResponderRelease: () => {
          swipeStartRef.current = null;
          setSwipeHud(null);
        },
        onPanResponderTerminate: () => {
          swipeStartRef.current = null;
          setSwipeHud(null);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isAdPlaying,
      isLocked,
      controls.swipeVolume,
      controls.swipeBrightness,
      volume,
      brightness,
      surfaceSize.width,
      surfaceSize.height,
    ],
  );

  useEffect(() => {
    if (!sleepEndsAt) {
      return undefined;
    }
    const endsAt = sleepEndsAt;
    const id = setInterval(() => {
      if (Date.now() >= endsAt) {
        setSleepEndsAt(null);
        setSleepMinutes(0);
        setIsPlaying(false);
        onPause && onPause(lastContentTimeRef.current);
      }
    }, 1000);
    return () => clearInterval(id);
    // Intentionally omit currentTime/onPause — interval reads refs/latest via closure reset on endsAt only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepEndsAt, setIsPlaying]);

  const cycleSleepTimer = () => {
    const idx = SLEEP_OPTIONS_MIN.indexOf(sleepMinutes);
    const next = SLEEP_OPTIONS_MIN[(idx + 1) % SLEEP_OPTIONS_MIN.length];
    setSleepMinutes(next);
    if (next === 0) {
      setSleepEndsAt(null);
      ActionToast?.show?.({
        title: labels.sleepTimer,
        message: labels.sleepOff || 'Sleep timer off',
        type: 'info',
        duration: 1600,
      });
    } else {
      setSleepEndsAt(Date.now() + next * 60 * 1000);
      ActionToast?.show?.({
        title: labels.sleepTimer,
        message: formatLabel(labels.sleepSet || 'Pauses in {minutes} min', {minutes: next}),
        type: 'success',
        duration: 1800,
      });
    }
  };

  const showPipUnsupported = (detail) => {
    ActionToast?.show?.({
      title: 'PiP',
      message: detail || labels.pipUnsupported || 'PiP is not supported on this device',
      type: 'warning',
      duration: 2200,
    });
  };

  const enterPip = async () => {
    resetHideTimer();
    if (isAdPlaying) {
      showPipUnsupported(labels.pipDuringAd || 'Not available during ads');
      return;
    }
    try {
      // Android PiP is Activity-level — immersive Modal must close first or PiP is a no-op.
      // Closing Modal remounts Video; wait then re-read the ref.
      if (isFullscreen) {
        setFullscreenState(false);
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      const video = videoRef.current;
      if (!video?.enterPictureInPicture && !video?.enterPictureInPictureMode) {
        showPipUnsupported();
        return;
      }
      if (!isPlaying) {
        setIsPlaying(true);
      }
      const enter =
        video.enterPictureInPicture || video.enterPictureInPictureMode;
      await Promise.resolve(enter.call(video));
    } catch (_e) {
      showPipUnsupported(
        labels.pipUnsupported ||
          'Enable PiP for this app in system settings (Android 8+)',
      );
    }
  };

  const handleShare = async () => {
    resetHideTimer();
    const query = `?t=${Math.floor(currentTime)}`;
    try {
      if (onShare) {
        await Promise.resolve(onShare(query));
        return;
      }
      const message = videoUrl ? `${videoUrl}${query}` : query;
      await Share.share(
        platform === 'ios' ? {url: message, message} : {message},
      );
    } catch (_e) {
      ActionToast?.show?.({
        title: labels.share || 'Share',
        message: labels.shareFailed || 'Could not open share sheet',
        type: 'error',
        duration: 1800,
      });
    }
  };

  const unlockControls = () => {
    ActionToast?.hide?.();
    setIsLocked(false);
    // Let the lock Modal finish tearing down before restoring chrome hit targets.
    requestAnimationFrame(() => {
      forceChromeVisible();
    });
  };

  const lockControls = () => {
    // Chrome is gated by `!isLocked`. Skip ActionToast — toast Modal steals
    // subsequent chrome taps on Android (settings/cast).
    ActionToast?.hide?.();
    setIsLocked(true);
  };

  const resumeContentAfterAds = () => {
    const queued = adQueueRef.current;
    if (queued.length) {
      const nextBreak = queued.shift();
      adQueueRef.current = queued;
      startAdBreak(nextBreak, {
        resumeAt: pendingSeekAfterAdsRef.current ?? contentTimeBeforeAdRef.current,
      });
      return;
    }

    const resumeAt =
      pendingSeekAfterAdsRef.current != null
        ? pendingSeekAfterAdsRef.current
        : contentTimeBeforeAdRef.current || 0;
    pendingSeekAfterAdsRef.current = null;
    adStartingRef.current = false;
    isAdPlayingRef.current = false;

    requestAnimationFrame(() => {
      if (videoRef.current?.seek) {
        videoRef.current.seek(resumeAt);
      }
      setCurrentTime(resumeAt);
      lastContentTimeRef.current = resumeAt;
      setIsPlaying(true);
      setIsLoading(false);
      showControlsNow();
    });
  };

  const endAdBreak = (skipped = false) => {
    const breakInfo = activeAd;
    if (breakInfo?.id) {
      playedAdIdsRef.current.add(breakInfo.id);
    }
    setActiveAd(null);
    setAdCreatives([]);
    setAdCreativeIndex(0);
    setAdCurrentTime(0);
    setAdDuration(0);
    if (skipped) {
      onAdSkip && onAdSkip(breakInfo);
    }
    onAdBreakEnd && onAdBreakEnd(breakInfo);
    resumeContentAfterAds();
  };

  const playNextCreativeOrEnd = (fromError = false) => {
    const advanceCreative = () => {
      setAdCreativeIndex((i) => i + 1);
      setAdCurrentTime(0);
      adCurrentTimeRef.current = 0;
      setAdDuration(0);
      setIsLoading(true);
      setIsBuffering(true);
      adWallStartRef.current = Date.now();
      setAdWallElapsed(0);
    };

    // Waterfall: success ends the break; error tries the next URL.
    if (adDeliveryMode === 'waterfall') {
      if (fromError && adCreativeIndex + 1 < adCreatives.length) {
        advanceCreative();
        return;
      }
      if (fromError) {
        onAdError && onAdError(new Error('Waterfall exhausted'), activeAd);
      }
      endAdBreak(false);
      return;
    }
    // Pod / single: advance on complete or error.
    if (adCreativeIndex + 1 < adCreatives.length) {
      advanceCreative();
      return;
    }
    endAdBreak(false);
  };

  playNextCreativeOrEndRef.current = playNextCreativeOrEnd;
  skipAdBreakRef.current = () => endAdBreak(true);

  // Black / frozen creative: media freeze OR wall-clock with almost no playback.
  useEffect(() => {
    if (!isAdPlaying) {
      return undefined;
    }
    let lastProgress = adCurrentTimeRef.current;
    let lastChangeAt = Date.now();
    const id = setInterval(() => {
      const mediaProgress = adCurrentTimeRef.current;
      if (mediaProgress > lastProgress + 0.2) {
        lastProgress = mediaProgress;
        lastChangeAt = Date.now();
      }
      const stalledFor = (Date.now() - lastChangeAt) / 1000;
      const wall = (Date.now() - adWallStartRef.current) / 1000;
      const stuck =
        stalledFor >= 8 || (wall >= 12 && mediaProgress < 1.5);
      if (stuck) {
        clearInterval(id);
        onAdError &&
          onAdError(new Error('Ad creative stall timeout'), activeAdRef.current);
        playNextCreativeOrEndRef.current(true);
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdPlaying, adCreativeIndex]);

  const startAdBreak = async (breakConfig, options = {}) => {
    if (adStartingRef.current && isAdPlayingRef.current) {
      return;
    }
    const id = breakConfig.id || getBreakId(breakConfig);
    const normalized = {...breakConfig, id};
    if (playedAdIdsRef.current.has(id) && !options.force) {
      return;
    }

    adStartingRef.current = true;
    isAdPlayingRef.current = true;
    contentTimeBeforeAdRef.current =
      options.resumeAt != null ? options.resumeAt : currentTime;
    if (options.resumeAt != null) {
      pendingSeekAfterAdsRef.current = options.resumeAt;
    }

    // Settings SPSheet sits above ad chrome — dismiss so skip / countdown stay usable.
    closeSettingsSheet();
    onSettingsClose && onSettingsClose();

    setIsPlaying(false);
    hideControlsNow();

    const picked = pickCreatives(normalized, {podEnabled: ads?.pod !== false});
    let creatives = picked.items || [];
    let mode = picked.mode || 'single';

    try {
      const vastAllowed = ads?.vast !== false;
      if (vastAllowed && (normalized.vast || creatives[0]?.vast)) {
        const vastUrl = normalized.vast || creatives[0].vast;
        const parsed = await fetchVast(vastUrl);
        if (parsed?.url) {
          creatives = [
            {
              url: parsed.url,
              skip: parsed.skip || normalized.skip,
              clickThroughUrl: parsed.clickThroughUrl || normalized.clickThroughUrl,
              mode: 'single',
            },
          ];
          mode = 'single';
        }
      }
    } catch (error) {
      adStartingRef.current = false;
      isAdPlayingRef.current = false;
      onAdError && onAdError(error, normalized);
      ActionToast?.show?.({
        title: labels.errorTitle,
        message: String(error?.message || error),
        type: 'error',
        duration: 2500,
      });
      playedAdIdsRef.current.add(id);
      resumeContentAfterAds();
      return;
    }

    if (!creatives.length || !creatives[0]?.url) {
      adStartingRef.current = false;
      isAdPlayingRef.current = false;
      onAdError && onAdError(new Error('No ad creatives'), normalized);
      playedAdIdsRef.current.add(id);
      resumeContentAfterAds();
      return;
    }

    setAdDeliveryMode(mode);
    setActiveAd(normalized);
    setAdCreatives(creatives);
    setAdCreativeIndex(0);
    setAdCurrentTime(0);
    setAdDuration(0);
    adWallStartRef.current = Date.now();
    setAdWallElapsed(0);
    adStartingRef.current = false;
    onAdBreakStart && onAdBreakStart(normalized);
  };

  // Wall-clock skip timer (YouTube-like): counts even while the ad is buffering.
  useEffect(() => {
    if (!isAdPlaying) {
      setAdWallElapsed(0);
      return undefined;
    }
    adWallStartRef.current = Date.now();
    setAdWallElapsed(0);
    const id = setInterval(() => {
      setAdWallElapsed((Date.now() - adWallStartRef.current) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [isAdPlaying, adCreativeIndex]);

  // Natural playback: fire midroll when playhead crosses cue (not on seek jump alone —
  // seeks are gated in handleSeek).
  useEffect(() => {
    if (!adsEnabled || isAdPlayingRef.current || adStartingRef.current || !duration) {
      return;
    }
    const prev = lastContentTimeRef.current;
    const next = currentTime;
    // Only treat as natural progress (small forward steps), not scrub jumps.
    if (next > prev && next - prev < Math.max(2.5, seekStep)) {
      const due = findCrossedBreak(
        ads.breaks,
        prev,
        next,
        duration,
        playedAdIdsRef.current,
      );
      if (due) {
        pendingSeekAfterAdsRef.current = null;
        adQueueRef.current = [];
        setIsPlaying(false);
        startAdBreak(due, {resumeAt: due.cueAt});
      }
    }
    lastContentTimeRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, duration, adsEnabled]);

  // Reset ad state when source / ads toggle changes; start preroll before content.
  useEffect(() => {
    playedAdIdsRef.current = new Set();
    adQueueRef.current = [];
    pendingSeekAfterAdsRef.current = null;
    lastContentTimeRef.current = 0;
    adStartingRef.current = false;
    isAdPlayingRef.current = false;
    setActiveAd(null);
    setAdCreatives([]);
    setAdCreativeIndex(0);
    setShowEndScreen(false);

    if (!adsEnabled) {
      return;
    }
    const preroll = ads.breaks.find((b) => b.position === 'preroll');
    if (preroll) {
      const id = getBreakId(preroll);
      startAdBreak({...preroll, id}, {resumeAt: startTime || resumeTime || 0});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, adsEnabled]);

  useEffect(() => {
    if (isAdPlayingRef.current || adStartingRef.current) {
      return;
    }
    if (resumeTime > 0 && videoRef.current?.seek && !isLoading) {
      videoRef.current.seek(resumeTime);
      setCurrentTime(resumeTime);
      lastContentTimeRef.current = resumeTime;
    } else if (startTime > 0 && videoRef.current?.seek && !isLoading) {
      videoRef.current.seek(startTime);
      setCurrentTime(startTime);
      lastContentTimeRef.current = startTime;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, videoUrl]);

  // Safety net if a sheet was opened just as the break started.
  const dismissSettings = useCallback(() => {
    setSettingsSession(null);
    closeSettingsSheet();
    onSettingsClose && onSettingsClose();
  }, [onSettingsClose]);

  useEffect(() => {
    if (!isAdPlaying) {
      return;
    }
    dismissSettings();
  }, [isAdPlaying, dismissSettings]);

  // Immersive remount / orientation change — drop any open sheet host.
  useEffect(() => {
    setSettingsSession(null);
    closeSettingsSheet();
  }, [isFullscreen]);

  const selectQuality = (itemQuality, manifestAudio) => {
    setIsLoading(true);
    if (itemQuality?.audioGroupId) {
      setSelectedAudioTrack({type: itemQuality.audioGroupId});
    }
    const bandwidth = itemQuality?.bandwidth ? itemQuality.bandwidth : 0;
    setSelectedMaxBitRate(parseInt(bandwidth, 10) || 0);
    setKey(Date.now().toString());
    setTimeout(() => {
      if (videoRef.current?.seek) {
        videoRef.current.seek(currentTime);
      }
      setIsLoading(false);
      onQualityChange && onQualityChange(itemQuality, manifestAudio);
      ActionToast?.show?.({
        title: labels.videoQuality,
        message: itemQuality?.label || labels.recommended,
        type: 'success',
        duration: 1800,
      });
    }, 300);
  };

  const openSettings = () => {
    if (!controls.settings || isAdPlaying || isLocked) {
      return;
    }
    ActionToast?.hide?.();
    onSettingsOpen && onSettingsOpen();
    const sheetHeight = resolveSheetHeight();
    const session = {
      playbackRate,
      onSpeedChange: setPlaybackRate,
      videoUrl,
      onQualityChange: selectQuality,
      accentColor: colors.accentColor,
      labels,
      audioTracks,
      textTracks: textTracks.length ? textTracks : externalTextTracks,
      selectedAudioTrack,
      selectedTextTrack,
      onAudioTrackChange: (sel, raw) => {
        setSelectedAudioTrack(sel);
        onAudioTrackChange && onAudioTrackChange(sel, raw);
      },
      onSubtitleChange: (sel, raw) => {
        setSelectedTextTrack(sel);
        onSubtitleChange && onSubtitleChange(sel, raw);
      },
      showQuality: true,
      showAudio: controls.audioTrackPicker,
      showSubtitles: controls.subtitlePicker,
      showSystemCaptions: controls.systemCaptions,
      showSubtitleStyle: controls.subtitleStyle,
      subtitleStyle,
      onSubtitleStyleChange: setSubtitleStyle,
      showResizeMode: true,
      resizeMode,
      onResizeModeChange: setResizeMode,
      sheetHeight,
      onClose: dismissSettings,
    };
    // Always host settings in a sibling Modal — SPSheet is another Modal and often
    // mounts empty / untappable on Android (especially after lock Modal).
    closeSettingsSheet();
    setSettingsSession(session);
  };

  const skipRule = currentCreative?.skip ?? activeAd?.skip;
  // Prefer media time; fall back to wall clock (state + live ref) so skip unlocks
  // even if a render batch missed an interval tick during buffer.
  const liveWall =
    isAdPlaying && adWallStartRef.current
      ? (Date.now() - adWallStartRef.current) / 1000
      : 0;
  const adSkipClock = Math.max(adCurrentTime, adWallElapsed, liveWall);
  const adCanSkip = canSkipAd(skipRule, adSkipClock, adDuration);
  const adCountdown = skipCountdownSeconds(skipRule, adSkipClock, adDuration);

  // Pass-through for react-native-video. `source` is merged below; SoulPlayer props win.
  const {source: videoPropsSource, ...restVideoProps} = videoProps || {};

  // Host often passes a fresh textTracks array literal each render — key by content.
  const externalTextTracksKey = Array.isArray(externalTextTracks)
    ? externalTextTracks
        .map((t) => `${t?.uri || ''}|${t?.language || ''}|${t?.title || ''}`)
        .join(';;')
    : '';
  const videoPropsSourceKey = videoPropsSource
    ? `${videoPropsSource.uri || ''}|${videoPropsSource.type || ''}`
    : '';

  // Stable source identity — a fresh object every render remounts/reloads the native
  // player on Android and can recurse through onLoadStart/onTextTracks → setState.
  const resolvedVideoSource = useMemo(() => {
    if (isAdPlaying) {
      return {
        uri: currentCreative?.url,
        type: currentCreative?.type || videoType,
      };
    }
    return {
      ...(videoPropsSource || {}),
      uri: videoUrl,
      type: videoType,
      textTracks: externalTextTracks,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by content fingerprints
  }, [
    isAdPlaying,
    currentCreative?.url,
    currentCreative?.type,
    videoPropsSourceKey,
    videoUrl,
    videoType,
    externalTextTracksKey,
  ]);

  const measurePlayerWindow = () => {
    if (!playerHostRef.current?.measureInWindow) {
      return;
    }
    playerHostRef.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        const next = {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        };
        setPlayerWindow((prev) =>
          prev.x === next.x &&
          prev.y === next.y &&
          prev.width === next.width &&
          prev.height === next.height
            ? prev
            : next,
        );
      }
    });
  };

  useEffect(() => {
    // Ads + Android chrome Modal both frame to the player window.
    measurePlayerWindow();
    const id = requestAnimationFrame(measurePlayerWindow);
    const t = setTimeout(measurePlayerWindow, 120);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [isAdPlaying, isLocked, isFullscreen, surfaceSize.width, surfaceSize.height]);

  const playerBody = (
    <View
      ref={playerHostRef}
      style={[styles.container, !isFullscreen && style]}
      testID="soul-player"
      accessible={false}
      onLayout={(e) => {
        const {width, height} = e.nativeEvent.layout;
        const w = Math.round(width);
        const h = Math.round(height);
        setSurfaceSize((prev) => {
          if (prev.width === w && prev.height === h) {
            return prev;
          }
          // Defer window measure to the size-change effect — avoid layout churn.
          return {width: w, height: h};
        });
      }}
    >
      {/*
        Keep Video in its own stack so the reveal catcher can sit as a later sibling
        above the native PlayerView (Fabric often appends the exo FrameLayout after
        later React children when Video lives as a direct host child).
      */}
      <View
        style={styles.videoStack}
        collapsable={false}
        // When chrome is hidden the reveal sibling must receive taps. If the native
        // PlayerView stack paints above that sibling, pointerEvents none lets hits
        // fall through to soul-chrome-reveal.
        pointerEvents={
          isLocked || (!showControls && !isAdPlaying) ? 'none' : 'box-none'
        }
      >
      <Video
        // Raw react-native-video pass-through (content only). SoulPlayer props below win.
        {...(isAdPlaying ? {} : restVideoProps)}
        ref={videoRef}
        // Ads: remount per creative (avoids black/stuck TextureView).
        // Content: include remount `key` state for retry / hard reload.
        key={
          isAdPlaying
            ? `ad-${adCreativeIndex}-${currentCreative?.url || ''}`
            : `content-${key}`
        }
        source={resolvedVideoSource}
        style={styles.video}
        resizeMode={resizeMode}
        controls={false}
        poster={isAdPlaying ? undefined : poster}
        paused={isAdPlaying ? false : !isPlaying || isAndroidCastConnected}
        muted={isAdPlaying ? false : isMuted || isAndroidCastConnected}
        volume={volume}
        rate={isAdPlaying ? 1 : playbackRate}
        onLoadStart={() => {
          setIsLoading(true);
          if (!isAdPlaying) {
            setPlaybackError(null);
            setShowEndScreen(false);
            onLoadStart && onLoadStart();
          }
        }}
        onLoad={(data) => {
          if (isAdPlaying) {
            setAdDuration(data.duration || 0);
            setIsLoading(false);
            return;
          }
          setIsLoading(false);
          setDuration(data.duration || 0);
          onLoad && onLoad(data);
        }}
        onProgress={(progress) => {
          if (isAdPlaying) {
            const t = progress.currentTime;
            adCurrentTimeRef.current = t;
            setAdCurrentTime(t);
            return;
          }
          const t = progress.currentTime;
          lastContentTimeRef.current = t;
          // Defer UI time updates — on Android, sync setState from onProgress during
          // lock/layout commits can re-enter and hit max update depth.
          if (progressUiScheduledRef.current) {
            return;
          }
          progressUiScheduledRef.current = true;
          requestAnimationFrame(() => {
            progressUiScheduledRef.current = false;
            const latest = lastContentTimeRef.current;
            setCurrentTime((prev) =>
              Math.abs(prev - latest) < 0.05 ? prev : latest,
            );
            onProgress && onProgress({...progress, currentTime: latest});
            onProgressPersist && onProgressPersist(latest);
          });
        }}
        onBuffer={({isBuffering: buffering}) => setIsBuffering(!!buffering)}
        onEnd={() => {
          if (isAdPlaying) {
            playNextCreativeOrEnd(false);
            return;
          }
          const postroll = adsEnabled
            ? ads.breaks.find((b) => b.position === 'postroll')
            : null;
          if (postroll) {
            const id = getBreakId(postroll);
            if (!playedAdIdsRef.current.has(id)) {
              startAdBreak({...postroll, id}, {resumeAt: duration});
              return;
            }
          }
          setIsPlaying(false);
          if (controls.endScreen) {
            setShowEndScreen(true);
          }
          onEnd && onEnd();
        }}
        onError={(error) => {
          if (isAdPlaying) {
            onAdError && onAdError(error, activeAd);
            playNextCreativeOrEnd(true);
            return;
          }
          setPlaybackError(error);
          setIsLoading(false);
          onError && onError(error);
          ActionToast?.show?.({
            title: labels.errorTitle,
            message: error?.errorString || error?.message || 'Error',
            type: 'error',
            duration: 3000,
          });
        }}
        onAudioTracks={({audioTracks: tracks}) => {
          const next = tracks || [];
          setAudioTracks((prev) => {
            if (
              prev.length === next.length &&
              prev.every(
                (t, i) =>
                  t?.index === next[i]?.index &&
                  t?.language === next[i]?.language &&
                  t?.title === next[i]?.title &&
                  t?.selected === next[i]?.selected,
              )
            ) {
              return prev;
            }
            return next;
          });
        }}
        onTextTracks={({textTracks: tracks}) => {
          const next = tracks || [];
          setTextTracks((prev) => {
            if (
              prev.length === next.length &&
              prev.every(
                (t, i) =>
                  t?.index === next[i]?.index &&
                  t?.language === next[i]?.language &&
                  t?.title === next[i]?.title &&
                  t?.selected === next[i]?.selected,
              )
            ) {
              return prev;
            }
            return next;
          });
        }}
        selectedAudioTrack={isAdPlaying ? undefined : selectedAudioTrack}
        selectedTextTrack={isAdPlaying ? undefined : selectedTextTrack}
        maxBitRate={isAdPlaying ? 0 : selectedMaxBitRate}
        subtitleStyle={subtitleStyle}
        pictureInPicture={!!controls.pip}
        playInBackground={!!controls.pip}
        onPictureInPictureStatusChanged={(e) => {
          setIsInPip(!!e?.isActive);
        }}
        // Best-effort TextureView request (RN-video may ignore). Real tap/chrome
        // solution lives in JS: Video pointerEvents=none + sibling reveal catcher.
        useTextureView={platform === 'android'}
        viewType={platform === 'android' ? 0 : undefined}
        pointerEvents="none"
        onSeek={(event) => !isAdPlaying && onSeek && onSeek(event.seekTime)}
      />

      {/*
        Middle-only gesture layer (never covers top/bottom chrome).
        Taps via Pressable; swipes via PanResponder (move-only, no start capture).
      */}
      {!isAdPlaying && !isLocked ? (
        // PanResponder + Pressable on the SAME node kills onPress on Android.
        // Outer View owns vertical swipes; inner Pressable owns tap / long-press.
        // When chrome is hidden, raise the surface above vignette layers so a single
        // tap can always reveal controls (TextureView / absolute chrome ate presses).
        <View
          collapsable={false}
          style={[
            styles.surface,
            showControls ? styles.surfaceWithChrome : styles.surfaceFull,
            !showControls && styles.surfaceCatchAll,
            // Guarantee a non-zero box even if top/bottom insets mis-measure.
            surfaceSize.height > 1 && {
              minHeight: showControls
                ? Math.max(80, surfaceSize.height - 72 - 320)
                : surfaceSize.height,
            },
          ]}
          {...surfacePanResponder.panHandlers}
        >
          <Pressable
            testID="soul-player-surface"
            accessibilityLabel="soul-player-surface"
            accessibilityRole="button"
            collapsable={false}
            onPress={handleSurfacePress}
            onLongPress={() => {
              if (!controls.holdToSpeed) {
                return;
              }
              holdBaseRateRef.current = playbackRate;
              setPlaybackRate(holdRate || controls.holdRate || 2);
              setSwipeHud({type: 'rate', value: holdRate || controls.holdRate || 2});
            }}
            onPressOut={() => {
              if (controls.holdToSpeed && holdBaseRateRef.current != null) {
                setPlaybackRate(holdBaseRateRef.current);
              }
              setSwipeHud(null);
            }}
            delayLongPress={380}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      ) : null}

      {seekHint ? (
        <View style={styles.seekHint}>
          <Text style={styles.seekHintText}>{seekHint}</Text>
        </View>
      ) : null}

      {swipeHud ? (
        <View style={styles.swipeHud} pointerEvents="none">
          <Text style={styles.swipeHudText}>
            {swipeHud.type === 'volume'
              ? `🔊 ${Math.round(swipeHud.value * 100)}%`
              : swipeHud.type === 'brightness'
                ? `☀ ${Math.round(swipeHud.value * 100)}%`
                : `${swipeHud.value}x`}
          </Text>
        </View>
      ) : null}

      {controls.titleOverlay && title && showControls && !isAdPlaying && !isLocked ? (
        <View style={styles.titleOverlay} pointerEvents="none">
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          {description ? (
            <Text style={styles.descText} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}

      {(isLiveProp || controls.live) && !isAdPlaying ? (
        <LiveBadge
          labels={labels}
          accentColor="#E11"
          showGoToLive={controls.goToLive && duration > 0}
          onGoToLive={() => handleSeek(duration)}
        />
      ) : null}

      {controls.offlineBadge && isOffline ? (
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineText}>{labels.offline}</Text>
        </View>
      ) : null}

      {ads?.companion && renderCompanion ? renderCompanion({ad: activeAd}) : null}

      {!isAdPlaying && !isLocked && (
        <SafeTopChrome
          key={`soul-top-${isFullscreen ? 'fs' : 'inline'}`}
          fadeAnim={fadeAnim}
          showControls={showControls}
          rtl={rtl}
        >
          {renderTopBar ? (
            renderTopBar({isFullscreen, labels, controls})
          ) : (
            <TopBar
              onResetHideTimer={resetHideTimer}
              isFullscreen={isFullscreen}
              onToggleFullscreen={setFullscreenState}
              videoUrl={videoUrl}
              title={title}
              currentTime={currentTime}
              handleSeek={handleSeek}
              showBack={controls.back}
              showFullscreen={controls.fullscreen}
              showCast={controls.cast}
              showLabels={controls.showLabels}
              labels={labels}
              onBackButton={onBackButton}
              setIsLoading={setIsLoading}
              onIsAndroidCastConnected={setIsAndroidCastConnected}
              isPlaying={isPlaying}
              onTogglePlayPause={togglePlayPause}
              onCastPress={onCastPress}
              onCastStateChange={onCastStateChange}
              isMuted={isMuted}
              volume={volume}
              accentColor={colors.accentColor}
              controlColor={colors.controlColor}
            />
          )}
        </SafeTopChrome>
      )}

      {(isLoading || (isAdPlaying && isBuffering)) && !playbackError ? (
        <ActivityIndicator size="large" color={colors.accentColor} style={styles.loader} />
      ) : null}
      {isBuffering && !isLoading && !playbackError && !isAdPlaying ? (
        <View style={styles.bufferBadge} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.accentColor} />
        </View>
      ) : null}
      {controls.debugOverlay ? (
        <View style={styles.debugOverlay} pointerEvents="none">
          <Text style={styles.debugText}>
            t={
              isAdPlaying
                ? `${adCurrentTime.toFixed(1)}/${adDuration.toFixed(1)}`
                : `${currentTime.toFixed(1)}/${duration.toFixed(1)}`
            }{' '}
            r={playbackRate}x
            {selectedMaxBitRate ? ` br=${selectedMaxBitRate}` : ''}
            {isBuffering ? ' buf' : ''}
            {isInPip ? ' pip' : ''}
            {isAdPlaying ? ` ad=${adCreativeIndex + 1}/${Math.max(adCreatives.length, 1)}` : ''}
          </Text>
        </View>
      ) : null}
      {drmActive ? (
        <View style={styles.drmChip} pointerEvents="none">
          <Text style={styles.drmText}>DRM</Text>
        </View>
      ) : null}

      {playbackError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{labels.errorTitle}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, {backgroundColor: colors.accentColor}]}
            onPress={() => {
              setPlaybackError(null);
              setKey(Date.now().toString());
            }}
          >
            <Text style={styles.retryText}>{labels.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showEndScreen && controls.endScreen && !isAdPlaying
        ? renderEndScreen
          ? renderEndScreen({onReplay: () => {
              setShowEndScreen(false);
              handleSeek(0);
              togglePlayPause(true);
            }})
          : (
            <EndScreen
              labels={labels}
              accentColor={colors.accentColor}
              items={endScreenItems}
              showNext={controls.next}
              onReplay={() => {
                setShowEndScreen(false);
                handleSeek(0);
                togglePlayPause(true);
              }}
              onNext={() => onNext && onNext()}
              onAction={(item) => onEndScreenAction && onEndScreenAction(item)}
            />
          )
        : null}

      {showControls && isVolumeBarVisible && controls.volumeGesture && !isAdPlaying ? (
        <View
          style={[
            styles.volumeSliderContainer,
            {left: volumeBarPosition.left, bottom: volumeBarPosition.bottom},
          ]}
        >
          <View style={styles.volumeBackground} />
          <Slider
            style={styles.volumeSlider}
            step={0.05}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={(value) => {
              setVolume(value);
              onVolumeChange && onVolumeChange(value);
              resetHideTimer();
            }}
            minimumTrackTintColor={colors.accentColor}
            maximumTrackTintColor={colors.trackColor}
            thumbTintColor={colors.accentColor}
          />
        </View>
      ) : null}

      {!isAdPlaying && !isLocked && (
        <SafeBottomChrome
          key={`soul-bottom-${isFullscreen ? 'fs' : 'inline'}`}
          fadeAnim={fadeAnim}
          showControls={showControls}
          isFullscreen={isFullscreen}
        >
          {renderBottomBar ? (
            renderBottomBar({
              currentTime,
              duration,
              isPlaying,
              labels,
              controls,
            })
          ) : (
            <BottomChromeVignette
              isFullscreen={isFullscreen}
              style={styles.bottomChrome}
              pointerEvents="box-none"
            >
              {controls.progress ? (
                <ProgressBar
                  currentTime={currentTime}
                  duration={duration}
                  accentColor={colors.accentColor}
                  trackColor={colors.trackColor}
                  tapToSeek={controls.tapToSeek}
                  scrubbing={controls.scrubbing}
                  chapters={controls.chapters ? chapters : []}
                  onSeek={handleSeek}
                  onSeekStart={() => {
                    isScrubbingRef.current = true;
                    showControlsNow();
                  }}
                  onSeekComplete={() => {
                    isScrubbingRef.current = false;
                    // Seek across midroll starts an ad break (chrome must stay hidden).
                    if (!isAdPlayingRef.current && !adStartingRef.current) {
                      showControlsNow();
                    }
                  }}
                />
              ) : null}

              <View style={[styles.controls, rtl && styles.rtlRow]}>
                {controls.previous ? (
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => onPrevious && onPrevious()}
                  >
                    <Text style={styles.navText}>{labels.previous}</Text>
                  </TouchableOpacity>
                ) : null}

                {controls.mute ? (
                  <TouchableOpacity
                    ref={volumeIconRef}
                    testID="soul-btn-mute"
                    accessibilityLabel={isMuted ? labels.unmute : labels.mute}
                    onLongPress={() => {
                      if (!controls.volumeGesture || !volumeIconRef.current) {
                        return;
                      }
                      volumeIconRef.current.measure((fx, fy, width, height, px, py) => {
                        const {height: windowHeight} = Dimensions.get('window');
                        setVolumeBarPosition({
                          left: px - width,
                          bottom:
                            platform === 'ios'
                              ? windowHeight - py - (height - 145)
                              : windowHeight - py,
                        });
                        setIsVolumeBarVisible(true);
                        resetHideTimer();
                      });
                    }}
                    onPress={() => {
                      if (isVolumeBarVisible) {
                        setIsVolumeBarVisible(false);
                      } else {
                        toggleMute();
                      }
                    }}
                    style={styles.controlButton}
                  >
                    <Icon
                      name={isMuted ? 'volume-off' : 'volume-up'}
                      size={28}
                      color={colors.controlColor}
                    />
                  </TouchableOpacity>
                ) : null}

                {controls.rewind ? (
                  <TouchableOpacity
                    testID="soul-btn-rewind"
                    accessibilityLabel={labels.rewind}
                    onPress={() => handleSeek(Math.max(0, currentTime - seekStep), 'rewind')}
                    style={styles.controlButton}
                  >
                    <Icon name="replay-10" size={28} color={colors.controlColor} />
                  </TouchableOpacity>
                ) : null}

                {controls.playPause ? (
                  <TouchableOpacity
                    testID="soul-btn-play-pause"
                    accessibilityLabel={isPlaying ? labels.pause : labels.play}
                    onPress={() => togglePlayPause()}
                    style={styles.controlButton}
                  >
                    <Icon
                      name={isPlaying ? 'pause' : 'play-arrow'}
                      size={40}
                      color={colors.controlColor}
                    />
                  </TouchableOpacity>
                ) : null}

                {controls.forward ? (
                  <TouchableOpacity
                    testID="soul-btn-forward"
                    accessibilityLabel={labels.forward}
                    onPress={() => {
                      const max = duration > 0 ? duration : currentTime + seekStep;
                      handleSeek(Math.min(max, currentTime + seekStep), 'forward');
                    }}
                    style={styles.controlButton}
                  >
                    <Icon name="forward-10" size={28} color={colors.controlColor} />
                  </TouchableOpacity>
                ) : null}

                {controls.settings ? (
                  <TouchableOpacity
                    testID="soul-btn-settings"
                    accessibilityLabel={labels.settings || 'Settings'}
                    accessibilityRole="button"
                    collapsable={false}
                    onPress={() => openSettings()}
                    style={styles.controlButton}
                  >
                    <Icon name="settings" size={28} color={colors.controlColor} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {(controls.lock ||
                controls.pip ||
                controls.sleepTimer ||
                controls.share ||
                controls.next) && (
                <View style={[styles.secondaryControls, rtl && styles.rtlRow]}>
                  {controls.lock ? (
                    <TouchableOpacity
                      testID="soul-btn-lock"
                      accessibilityLabel={labels.lock}
                      onPress={lockControls}
                      style={styles.controlButton}
                    >
                      <Text style={styles.navText} numberOfLines={1}>
                        {labels.lock}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {controls.pip ? (
                    <TouchableOpacity
                      testID="soul-btn-pip"
                      accessibilityLabel="PiP"
                      accessibilityHint={labels.pipHint}
                      onPress={enterPip}
                      style={styles.controlButton}
                    >
                      <Text style={styles.navText}>PiP</Text>
                    </TouchableOpacity>
                  ) : null}

                  {controls.sleepTimer ? (
                    <TouchableOpacity
                      testID="soul-btn-sleep"
                      accessibilityLabel={labels.sleepTimer}
                      onPress={cycleSleepTimer}
                      style={styles.controlButton}
                    >
                      <Text style={styles.navText} numberOfLines={1}>
                        {sleepMinutes ? `${sleepMinutes}m` : labels.sleepTimer}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {controls.next ? (
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => onNext && onNext()}
                    >
                      <Text style={styles.navText}>{labels.next}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {controls.share ? (
                    <TouchableOpacity
                      testID="soul-btn-share"
                      accessibilityLabel={labels.share}
                      style={styles.controlButton}
                      onPress={handleShare}
                    >
                      <Text style={styles.navText} numberOfLines={1}>
                        {labels.share}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {(controls.currentTime || controls.duration) && (
                <View style={styles.timeContainer}>
                  {controls.currentTime ? (
                    <Text
                      testID="soul-time-current"
                      style={[styles.time, {color: colors.controlColor}]}
                    >
                      {formatTime(currentTime)}
                    </Text>
                  ) : (
                    <View />
                  )}
                  {controls.duration ? (
                    <Text
                      testID="soul-time-duration"
                      style={[styles.time, {color: colors.controlColor}]}
                    >
                      {formatTime(duration)}
                    </Text>
                  ) : null}
                </View>
              )}
            </BottomChromeVignette>
          )}
        </SafeBottomChrome>
      )}
      </View>

      {/*
        In-tree reveal catcher (both platforms). Mid-surface Pressable also reveals
        via handleSurfacePress when chrome is hidden. Avoid a transparent Modal —
        it steals the key window and blocks host UI / Maestro.
      */}
      {!showControls && !isAdPlaying && !isLocked ? (
        <TouchableOpacity
          testID="soul-chrome-reveal"
          accessibilityLabel="Show player controls"
          accessibilityRole="button"
          activeOpacity={1}
          collapsable={false}
          onPress={() => forceChromeVisible()}
          style={[
            styles.chromeReveal,
            {
              width: surfaceSize.width > 1 ? surfaceSize.width : '100%',
              height: surfaceSize.height > 1 ? surfaceSize.height : '100%',
            },
          ]}
        />
      ) : null}
    </View>
  );

  // Outside immersive fullscreen Modal — nested Modals on Android can render
  // invisible / untappable (ad skip). Lock uses a dedicated Modal so unlock stays
  // above the native player in the a11y/hit tree.
  const playerWindowFrame =
    playerWindow.width > 0
      ? {
          top: playerWindow.y,
          left: playerWindow.x,
          width: playerWindow.width,
          height: playerWindow.height,
        }
      : StyleSheet.absoluteFillObject;

  const lockOverlayModal = isLocked ? (
    <Modal
      key="soul-lock-modal"
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={unlockControls}
    >
      <View style={styles.lockModalRoot} collapsable={false}>
        <Pressable
          testID="soul-btn-unlock"
          accessibilityLabel={labels.unlock || 'Unlock'}
          accessibilityRole="button"
          accessibilityHint={labels.lockHint || 'Press and hold to unlock'}
          delayLongPress={700}
          onLongPress={unlockControls}
          style={styles.lockOverlay}
        >
          <View
            collapsable={false}
            pointerEvents="none"
            style={styles.lockHitSurface}
          />
        </Pressable>
      </View>
    </Modal>
  ) : null;

  const adOverlayModal = isAdPlaying ? (
    <Modal
      key="soul-ad-modal"
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent={platform === 'android' ? true : undefined}
      presentationStyle="overFullScreen"
      onRequestClose={() => {}}
    >
      <PlayerSafeAreaProvider>
        <View style={styles.adModalRoot} pointerEvents="box-none">
          <View pointerEvents="box-none" style={[styles.adModalFrame, playerWindowFrame]}>
            {renderAdOverlay ? (
              renderAdOverlay({
                ad: activeAd,
                canSkip: adCanSkip,
                countdown: adCountdown,
                currentTime: adCurrentTime,
                duration: adDuration,
                podIndex: adCreativeIndex,
                podTotal: adCreatives.length,
                onSkip: () => skipAdBreakRef.current?.(),
              })
            ) : (
              <SafeAdOverlay
                isFullscreen={isFullscreen}
                labels={labels}
                accentColor={colors.accentColor}
                canSkip={adCanSkip}
                countdown={adCountdown}
                currentTime={adCurrentTime}
                duration={adDuration}
                podIndex={adCreativeIndex}
                podTotal={adCreatives.length}
                clickThroughUrl={currentCreative?.clickThroughUrl || activeAd?.clickThroughUrl}
                onSkip={() => skipAdBreakRef.current?.()}
                onClick={() => onAdClick && onAdClick(activeAd)}
              />
            )}
          </View>
        </View>
      </PlayerSafeAreaProvider>
    </Modal>
  ) : null;

  const settingsOverlayModal = settingsSession ? (
    <Modal
      key="soul-settings-host"
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent={platform === 'android' ? true : undefined}
      presentationStyle="overFullScreen"
      supportedOrientations={['landscape', 'portrait']}
      onRequestClose={dismissSettings}
    >
      <View style={styles.settingsModalRoot} collapsable={false} testID="soul-settings-host">
        <TouchableOpacity
          testID="soul-settings-mask"
          accessibilityLabel={labels.close || 'Close'}
          activeOpacity={1}
          onPress={dismissSettings}
          style={styles.settingsModalMask}
        />
        <View
          style={[
            styles.settingsModalSheet,
            {height: settingsSession.sheetHeight || resolveSheetHeight()},
          ]}
          collapsable={false}
          testID="soul-settings-modal"
        >
          <SettingsMenu {...settingsSession} />
        </View>
      </View>
    </Modal>
  ) : null;

  const overlayModals = (
    <>
      {adOverlayModal}
      {settingsOverlayModal}
      {lockOverlayModal}
    </>
  );

  if (fullscreenMode === 'immersive' && isFullscreen) {
    return (
      <>
        <Modal
          visible
          animationType="fade"
          // Landscape-only: with Info.plist + AppDelegate mask, forces rotate on enter FS.
          supportedOrientations={['landscape']}
          statusBarTranslucent
          navigationBarTranslucent={platform === 'android' ? true : undefined}
          onShow={forceChromeVisible}
          onRequestClose={() => setFullscreenState(false)}
        >
          {/* Fresh provider: Modal is a new window; parent SafeAreaView insets won't apply. */}
          <PlayerSafeAreaProvider style={styles.immersiveRoot}>
            <View style={styles.immersiveRoot} collapsable={false}>
              {playerBody}
            </View>
          </PlayerSafeAreaProvider>
        </Modal>
        {overlayModals}
      </>
    );
  }

  return (
    <>
      {playerBody}
      {overlayModals}
    </>
  );
});

SoulPlayer.displayName = 'SoulPlayer';

/** Reads insets under the nearest SafeAreaProvider (immersive Modal remounts one). */
function SafeTopChrome({fadeAnim, showControls, rtl, children}) {
  // No edge padding here — side/top pads live inside ChromeVignette content so
  // the fade reaches the player edges (outer pad left a right-edge hairline).
  if (!showControls) {
    return null;
  }
  return (
    <Animated.View
      style={[styles.topBar, {opacity: fadeAnim}, rtl && styles.rtlRow]}
      pointerEvents="auto"
    >
      {children}
    </Animated.View>
  );
}

function SafeBottomChrome({fadeAnim, showControls, isFullscreen, children}) {
  // Unmount when hidden so Android UiAutomator/Maestro don't keep seeing chrome
  // nodes (opacity:0 + accessibilityElementsHidden is not enough on API 34+).
  if (!showControls) {
    return null;
  }
  return (
    <Animated.View
      style={[
        styles.controlsContainer,
        // Inline Android: elevation casts a hairline under the player edge.
        platform === 'android' && !isFullscreen && styles.controlsContainerInlineAndroid,
        {opacity: fadeAnim},
      ]}
      pointerEvents="auto"
    >
      {children}
    </Animated.View>
  );
}

function SafeAdOverlay({isFullscreen = false, ...props}) {
  const insets = usePlayerSafeArea();
  // Ad Modal is already framed to the player window — only apply top safe-area
  // in immersive FS (same rule as TopBar). Inline double-counts the notch and
  // pushes badge / learn-more into the mid-frame.
  const topInset = isFullscreen ? Math.min(Math.max(insets.top || 0, 8), 64) : 0;
  const edgeInsets = {
    top: topInset,
    right: Math.min(Math.max(insets.right || 0, 0), 24),
    bottom: 0,
    left: Math.min(Math.max(insets.left || 0, 0), 24),
  };
  return <AdOverlay {...props} edgeInsets={edgeInsets} />;
}

/** Bottom fade + content pad inside the vignette so gradient reaches player edges. */
function BottomChromeVignette({isFullscreen, style, pointerEvents, children}) {
  const insets = usePlayerSafeArea();
  return (
    <ChromeVignette
      edge="bottom"
      style={style}
      contentStyle={{
        paddingBottom: isFullscreen ? Math.max(insets.bottom || 0, 8) : 4,
        paddingLeft: Math.max(insets.left || 0, 0),
        paddingRight: Math.max(insets.right || 0, 0),
      }}
      pointerEvents={pointerEvents}
    >
      {children}
    </ChromeVignette>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  videoStack: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 1,
  },
  immersiveRoot: {flex: 1, width: '100%', height: '100%', backgroundColor: '#000'},
  adModalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  adModalFrame: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 300,
    elevation: 300,
  },
  settingsModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  settingsModalMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  settingsModalSheet: {
    width: '100%',
    backgroundColor: '#171717',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  video: {width: '100%', height: '100%'},
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Above TextureView/ExoPlayer on Android so single-tap can reveal chrome.
    zIndex: 20,
    elevation: 20,
  },
  surfaceFull: {
    top: 0,
    bottom: 0,
  },
  // Above faded chrome / vignette so reveal taps aren't lost after auto-hide.
  surfaceCatchAll: {
    zIndex: 250,
    elevation: 250,
  },
  chromeReveal: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
    // 1% alpha keeps the view in Android's hit/a11y tree (fully transparent often drops).
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  // Keep clear of TopBar + soft + wrapped icon rows + soft vignette fade.
  // Turkish labels (Uyku zamanlayıcı / Paylaş) wrap to a 2nd row — 200px was too short
  // and the middle Pressable ate settings/lock/pip taps on Android.
  surfaceWithChrome: {
    top: 72,
    bottom: 320,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    elevation: 200,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  controlsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    elevation: 200,
    // If fade image ever inflates height, keep controls glued to the bottom edge.
    justifyContent: 'flex-end',
  },
  controlsContainerInlineAndroid: {
    elevation: 0,
  },
  bottomChrome: {
    width: '100%',
    // Soft fade from the player bottom — keep modest so video stays visible.
    minHeight: 108,
    justifyContent: 'flex-end',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
    width: '100%',
  },
  secondaryControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
    width: '100%',
    marginTop: 0,
    rowGap: 0,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
    minWidth: 48,
    minHeight: 32,
  },
  navText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 96,
    textAlign: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 0,
    paddingBottom: 2,
  },
  time: {fontSize: 12, fontWeight: '600'},
  loader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
  },
  bufferBadge: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 8,
    zIndex: 28,
  },
  swipeHud: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 45,
  },
  swipeHudText: {color: '#fff', fontWeight: '800', fontSize: 16},
  lockModalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  lockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  lockHitSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  debugOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 42,
  },
  debugText: {color: '#0f0', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'},
  drmChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(245,197,66,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 42,
  },
  drmText: {color: '#111', fontSize: 10, fontWeight: '800'},
  volumeSliderContainer: {
    position: 'absolute',
    width: 40,
    height: 140,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
  },
  volumeSlider: {
    width: 120,
    height: 40,
    transform: [{rotate: '-90deg'}],
  },
  seekHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    zIndex: 50,
  },
  seekHintText: {color: '#fff', fontWeight: '800', fontSize: 18},
  titleOverlay: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 22,
  },
  titleText: {color: '#fff', fontWeight: '800', fontSize: 16},
  descText: {color: '#ccc', fontSize: 12, marginTop: 2},
  offlineBadge: {
    position: 'absolute',
    top: 56,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 25,
  },
  offlineText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  errorBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 45,
    padding: 24,
  },
  errorTitle: {color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12},
  retryBtn: {paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10},
  retryText: {color: '#111', fontWeight: '800'},
});

export default SoulPlayer;
