export const DEFAULT_CONTROLS = {
  showLabels: true,
  seekStep: 10,
  autoHide: true,
  autoHideDelay: 3000,
  singleTapToggleControls: true,
  doubleTapPlayPause: true,
  doubleTapSeek: true,
  holdToSpeed: true,
  holdRate: 2,
  swipeVolume: true,
  swipeBrightness: true,
  back: undefined,
  fullscreen: true,
  cast: undefined,
  progress: true,
  tapToSeek: true,
  scrubbing: true,
  currentTime: true,
  duration: true,
  mute: true,
  volumeGesture: true,
  rewind: true,
  playPause: true,
  forward: true,
  settings: true,
  audioTrackPicker: true,
  subtitlePicker: true,
  subtitleStyle: true,
  systemCaptions: true,
  next: false,
  previous: false,
  live: false,
  goToLive: true,
  chapters: true,
  endScreen: true,
  offlineBadge: false,
  sleepTimer: false,
  share: false,
  debugOverlay: false,
  drmStatus: false,
  titleOverlay: true,
  pip: false,
  lock: true,
};

export const mergeControls = (overrides = {}, legacy = {}) => {
  const merged = {...DEFAULT_CONTROLS, ...overrides};
  if (merged.back === undefined) {
    merged.back = !!legacy.showBackButton;
  }
  if (merged.cast === undefined) {
    merged.cast = legacy.showCastButton !== false;
  }
  return merged;
};
