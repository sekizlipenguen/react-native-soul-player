declare module '@sekizlipenguen/react-native-soul-player' {
  import * as React from 'react';
  import {StyleProp, ViewStyle} from 'react-native';

  export type SoulPlayerTheme = {
    accentColor?: string;
    trackColor?: string;
    controlColor?: string;
  };

  export type SoulPlayerLabels = {
    back?: string;
    fullscreen?: string;
    exitFullscreen?: string;
    cast?: string;
    castStop?: string;
    rewind?: string;
    forward?: string;
    play?: string;
    pause?: string;
    mute?: string;
    unmute?: string;
    settings?: string;
    settingsTitle?: string;
    close?: string;
    done?: string;
    playbackSpeed?: string;
    videoQuality?: string;
    recommended?: string;
    recommendedMeta?: string;
    qualitiesLoading?: string;
    qualitiesEmpty?: string;
    audio?: string;
    subtitles?: string;
    off?: string;
    systemCaptions?: string;
    subtitleStyle?: string;
    subtitleFontSize?: string;
    subtitleColor?: string;
    subtitleBackground?: string;
    subtitleColorWhite?: string;
    subtitleColorYellow?: string;
    subtitleColorCyan?: string;
    subtitleBgNone?: string;
    subtitleBgDark?: string;
    subtitleBgSolid?: string;
    ad?: string;
    skipAd?: string;
    skipIn?: string;
    adRemaining?: string;
    learnMore?: string;
    adCountdown?: string;
    live?: string;
    goToLive?: string;
    next?: string;
    previous?: string;
    replay?: string;
    retry?: string;
    errorTitle?: string;
    lock?: string;
    unlock?: string;
    lockHint?: string;
    lockedToast?: string;
    unlockedToast?: string;
    castHoldHint?: string;
    pipUnsupported?: string;
    pipDuringAd?: string;
    pipStarted?: string;
    pipHint?: string;
    shareFailed?: string;
    sleepOff?: string;
    sleepSet?: string;
    offline?: string;
    share?: string;
    sleepTimer?: string;
    resizeMode?: string;
    contain?: string;
    cover?: string;
    stretch?: string;
  };

  export type SoulPlayerControls = {
    showLabels?: boolean;
    seekStep?: number;
    autoHide?: boolean;
    autoHideDelay?: number;
    singleTapToggleControls?: boolean;
    doubleTapPlayPause?: boolean;
    doubleTapSeek?: boolean;
    holdToSpeed?: boolean;
    holdRate?: number;
    swipeVolume?: boolean;
    swipeBrightness?: boolean;
    back?: boolean;
    fullscreen?: boolean;
    cast?: boolean;
    progress?: boolean;
    tapToSeek?: boolean;
    scrubbing?: boolean;
    currentTime?: boolean;
    duration?: boolean;
    mute?: boolean;
    volumeGesture?: boolean;
    rewind?: boolean;
    playPause?: boolean;
    forward?: boolean;
    settings?: boolean;
    audioTrackPicker?: boolean;
    subtitlePicker?: boolean;
    subtitleStyle?: boolean;
    systemCaptions?: boolean;
    next?: boolean;
    previous?: boolean;
    live?: boolean;
    goToLive?: boolean;
    chapters?: boolean;
    endScreen?: boolean;
    offlineBadge?: boolean;
    sleepTimer?: boolean;
    share?: boolean;
    debugOverlay?: boolean;
    drmStatus?: boolean;
    titleOverlay?: boolean;
    pip?: boolean;
    lock?: boolean;
  };

  export type AdSkip =
    | false
    | {mode: 'never'}
    | {mode: 'afterSeconds'; value: number}
    | {mode: 'afterPercent'; value: number};

  export type AdBreak = {
    id?: string;
    position: 'preroll' | 'postroll' | number | `${number}%`;
    url?: string;
    urls?: string[];
    creatives?: Array<{
      url: string;
      type?: string;
      skip?: AdSkip;
      clickThroughUrl?: string;
      vast?: string;
    }>;
    type?: string;
    clickThroughUrl?: string;
    skip?: AdSkip;
    vast?: string;
  };

  export type SoulPlayerAds = {
    enabled?: boolean;
    breaks: AdBreak[];
    companion?: boolean;
    vast?: boolean;
    pod?: boolean;
  };

  export type Chapter = {id?: string; time: number; title?: string};

  export type ExternalTextTrack = {
    title?: string;
    language?: string;
    type?: string;
    uri: string;
  };

  export interface SoulPlayerProps {
    videoUrl: string;
    videoType?: 'mp4' | 'm3u8' | string;
    title?: string;
    description?: string;
    poster?: string;
    paused?: boolean;
    resizeMode?: 'contain' | 'cover' | 'stretch' | 'none';
    showBackButton?: boolean;
    showCastButton?: boolean;
    theme?: SoulPlayerTheme;
    controls?: SoulPlayerControls;
    labels?: Partial<SoulPlayerLabels>;
    locale?: string | 'auto';
    fullscreenMode?: 'immersive' | 'layout';
    enterFullscreenOnRotate?: boolean;
    exitFullscreenOnPortrait?: boolean;
    textTracks?: ExternalTextTrack[];
    ads?: SoulPlayerAds;
    chapters?: Chapter[];
    endScreenItems?: Array<{id?: string; title?: string; label?: string; url?: string}>;
    resumeTime?: number;
    startTime?: number;
    isLive?: boolean;
    isOffline?: boolean;
    preset?: 'full' | 'minimal' | 'youtube' | 'tv';
    holdRate?: number;
    style?: StyleProp<ViewStyle>;
    /**
     * Raw props forwarded to `react-native-video` (content playback only; not during ads).
     * SoulPlayer-controlled props (`source.uri`, `paused`, handlers, `controls`, …) always win.
     * Merge extras on `source` (headers, drm in source, etc.) via `videoProps.source`.
     */
    videoProps?: Record<string, unknown>;
    renderTopBar?: (ctx: Record<string, unknown>) => React.ReactNode;
    renderBottomBar?: (ctx: Record<string, unknown>) => React.ReactNode;
    renderAdOverlay?: (ctx: Record<string, unknown>) => React.ReactNode;
    renderEndScreen?: (ctx: Record<string, unknown>) => React.ReactNode;
    renderCompanion?: (ctx: Record<string, unknown>) => React.ReactNode;

    onLoadStart?: () => void;
    onError?: (error: unknown) => void;
    onEnd?: () => void;
    onSeek?: (time: number) => void;
    onProgress?: (progress: {
      currentTime: number;
      playableDuration?: number;
      seekableDuration?: number;
    }) => void;
    onLoad?: (data: {duration: number; [key: string]: unknown}) => void;
    onMuteToggle?: (muted: boolean) => void;
    onVolumeChange?: (volume: number) => void;
    onQualityChange?: (quality: unknown, audioTracks?: unknown[]) => void;
    onAudioTrackChange?: (selected: unknown, track?: unknown) => void;
    onSubtitleChange?: (selected: unknown, track?: unknown) => void;
    onFullScreen?: (status: boolean) => void;
    onFullScreenEnter?: () => void;
    onFullScreenExit?: () => void;
    onPlay?: (time: number) => void;
    onPause?: (time: number) => void;
    onBackButton?: () => void;
    onRewind?: (time: number) => void;
    onForward?: (time: number) => void;
    onSettingsOpen?: () => void;
    onSettingsClose?: () => void;
    onCastPress?: () => void;
    onCastStateChange?: (connected: boolean) => void;
    onControlsVisibilityChange?: (visible: boolean) => void;
    onNext?: () => void;
    onPrevious?: () => void;
    onEndScreenAction?: (item: unknown) => void;
    onShare?: (query: string) => void;
    onAdBreakStart?: (adBreak: AdBreak) => void;
    onAdBreakEnd?: (adBreak: AdBreak) => void;
    onAdSkip?: (adBreak: AdBreak) => void;
    onAdClick?: (adBreak: AdBreak) => void;
    onAdError?: (error: unknown, adBreak?: AdBreak) => void;
    onProgressPersist?: (time: number) => void;
  }

  export interface SoulPlayerRef {
    getInfo: () => {
      duration: number;
      currentTime: number;
      isFullscreen?: boolean;
      isAdPlaying?: boolean;
    };
    videoRef: () => unknown;
    seek: (time: number) => void;
    enterFullscreen?: () => void;
    exitFullscreen?: () => void;
    showChrome?: () => void;
    hideChrome?: () => void;
  }

  const SoulPlayer: React.ForwardRefExoticComponent<
    SoulPlayerProps & React.RefAttributes<SoulPlayerRef>
  >;

  export default SoulPlayer;
  export {SoulPlayer};
  export function resolveLabels(
    locale?: string | 'auto',
    overrides?: Partial<SoulPlayerLabels>,
  ): SoulPlayerLabels;
  export const SUPPORTED_LOCALES: string[];
  export function normalizeLocale(locale?: string | 'auto'): string;
  export const DEFAULT_CONTROLS: SoulPlayerControls;
  export function mergeControls(
    overrides?: SoulPlayerControls,
    legacy?: {showBackButton?: boolean; showCastButton?: boolean},
  ): SoulPlayerControls;
}
