import React, {useEffect, useMemo, useState} from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {analyzeManifest} from '../utils/AnalyzeManifest';

const SHEET_BG = '#171717';

/** Recompute on each open — portrait module-load height breaks landscape fullscreen. */
export const resolveSheetHeight = () => {
  const {height, width} = Dimensions.get('window');
  const shortSide = Math.min(height, width);
  const tallSide = Math.max(height, width);
  // Landscape (fullscreen): keep sheet under ~82% of the short side so it fits.
  const landscape = width > height;
  const base = landscape ? shortSide : tallSide;
  return Math.min(landscape ? 420 : 560, Math.round(base * (landscape ? 0.88 : 0.78)));
};

const formatSpeed = (speed) =>
  Number.isInteger(speed) ? `${speed}` : parseFloat(speed.toFixed(2)).toString();

const SPEED_PRESETS = [0.25, 1, 1.25, 1.5, 2];

let SPSheet = null;
let GestureHandlerRootView = View;
let ScrollingButtonMenu = null;
try {
  SPSheet = require('@sekizlipenguen/react-native-popup-confirm-toast').SPSheet;
} catch (_e) {
  SPSheet = null;
}
try {
  // SPSheet uses RN Modal — GH root is required for any GH descendants / reliable pans.
  GestureHandlerRootView = require('react-native-gesture-handler').GestureHandlerRootView;
} catch (_e) {
  GestureHandlerRootView = View;
}
try {
  const scrollMenu = require('@sekizlipenguen/react-native-scroll-menu');
  ScrollingButtonMenu = scrollMenu.ScrollingButtonMenu || scrollMenu.default;
} catch (_e) {
  ScrollingButtonMenu = null;
}

/**
 * Horizontal chip row via @sekizlipenguen/react-native-scroll-menu.
 * Falls back to a simple wrap row if the package is missing.
 */
const ChipMenu = ({items, selected, onPress, accentColor}) => {
  if (!items?.length) {
    return null;
  }
  if (ScrollingButtonMenu) {
    return (
      <ScrollingButtonMenu
        items={items}
        selected={selected}
        onPress={onPress}
        activeBackgroundColor={accentColor}
        activeColor="#111"
        // Package defaults paddingLeft/Top: 20 — sheet already pads; flush to section label.
        containerStyle={styles.scrollMenuContainer}
        contentContainerStyle={styles.scrollMenuContent}
        buttonStyle={styles.chip}
        textStyle={styles.chipText}
        activeTextStyle={styles.chipTextActive}
        activeButtonStyle={{borderColor: accentColor}}
        gap={8}
        autoCenter
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      />
    );
  }
  return (
    <View style={styles.chipRow}>
      {items.map((item) => {
        const active = String(selected) === String(item.id);
        return (
          <TouchableOpacity
            key={String(item.id)}
            disabled={item.disabled}
            onPress={() => onPress(item)}
            activeOpacity={0.85}
            style={[
              styles.chip,
              active && {backgroundColor: accentColor, borderColor: accentColor},
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const Section = ({label, children}) => (
  <View style={styles.section}>
    {label ? <Text style={styles.sectionLabel}>{label}</Text> : null}
    {children}
  </View>
);

const matchAudioId = (list, selectedAudioTrack) => {
  if (!list.length) {
    return null;
  }
  if (!selectedAudioTrack) {
    return list[0].id;
  }
  const hit = list.find(
    (item) =>
      selectedAudioTrack.value === item.value ||
      selectedAudioTrack.index === item.value ||
      selectedAudioTrack.value === item.raw?.index,
  );
  return hit?.id || list[0].id;
};

const matchTextId = (list, selectedTextTrack) => {
  if (!selectedTextTrack || selectedTextTrack.type === 'disabled') {
    return 'off';
  }
  if (selectedTextTrack.type === 'system') {
    return 'system';
  }
  const hit = list.find(
    (item) =>
      selectedTextTrack.value === item.value ||
      selectedTextTrack.index === item.value ||
      selectedTextTrack.value === item.raw?.index ||
      selectedTextTrack.value === item.raw?.language,
  );
  return hit?.id || 'off';
};

const SettingsMenu = ({
  playbackRate,
  onSpeedChange,
  videoUrl,
  onQualityChange,
  accentColor = '#F5C542',
  labels = {},
  audioTracks = [],
  textTracks = [],
  selectedAudioTrack,
  selectedTextTrack,
  onAudioTrackChange,
  onSubtitleChange,
  showQuality = true,
  showAudio = true,
  showSubtitles = true,
  showSystemCaptions = false,
  showSubtitleStyle = false,
  subtitleStyle,
  onSubtitleStyleChange,
  resizeMode,
  onResizeModeChange,
  showResizeMode = false,
  onClose,
  sheetHeight: sheetHeightProp,
}) => {
  const sheetHeight = sheetHeightProp || resolveSheetHeight();
  const [draftSpeed, setDraftSpeed] = useState(playbackRate);
  const [qualities, setQualities] = useState([]);
  const [manifestAudio, setManifestAudio] = useState([]);
  const [draftQualityId, setDraftQualityId] = useState('recommended');
  const [draftAudioId, setDraftAudioId] = useState(null);
  const [draftTextId, setDraftTextId] = useState(null);
  const [draftResize, setDraftResize] = useState(resizeMode || 'cover');
  const [draftFontSize, setDraftFontSize] = useState(subtitleStyle?.fontSize || 18);
  const [draftSubColor, setDraftSubColor] = useState(subtitleStyle?.color || '#FFFFFF');
  const [draftSubBg, setDraftSubBg] = useState(
    subtitleStyle?.backgroundColor || 'transparent',
  );
  const [loadingQualities, setLoadingQualities] = useState(false);
  const [dirty, setDirty] = useState({
    speed: false,
    quality: false,
    audio: false,
    text: false,
    resize: false,
    font: false,
  });
  const markDirty = (key) => setDirty((prev) => ({...prev, [key]: true}));

  useEffect(() => {
    setDraftSpeed(playbackRate);
  }, [playbackRate]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!videoUrl || !showQuality) {
        setQualities([]);
        return;
      }
      setLoadingQualities(true);
      try {
        const result = await analyzeManifest(videoUrl);
        if (cancelled) {
          return;
        }
        if (result.type !== 'HLS') {
          setQualities([]);
          setManifestAudio([]);
          return;
        }
        const byHeight = new Map();
        result.streams.forEach((stream) => {
          if (!stream.HEIGHT) {
            return;
          }
          const bandwidth = parseInt(stream.BANDWIDTH, 10) || 0;
          const prev = byHeight.get(stream.HEIGHT);
          if (!prev || bandwidth > prev.bandwidth) {
            byHeight.set(stream.HEIGHT, {
              id: `h-${stream.HEIGHT}`,
              label: stream.QUALITY,
              detail: stream.RESOLUTION,
              height: stream.HEIGHT,
              bandwidth,
              url: stream.URI,
              audioGroupId: stream.AUDIO,
            });
          }
        });
        setQualities(Array.from(byHeight.values()).sort((a, b) => a.height - b.height));
        setManifestAudio(
          result.metadata.map((audio, index) => ({
            id: `a-${audio['GROUP-ID'] || index}-${index}`,
            title: audio.NAME || audio.LANGUAGE || audio['GROUP-ID'] || `Audio ${index + 1}`,
            language: audio.LANGUAGE,
            type: 'language',
            value: audio.LANGUAGE || audio.NAME || index,
            groupId: audio['GROUP-ID'],
            uri: audio.URI,
          })),
        );
        setDraftQualityId((prev) => prev || 'recommended');
      } catch (_e) {
        if (!cancelled) {
          setQualities([]);
          setManifestAudio([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingQualities(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [videoUrl, showQuality]);

  const audioList = useMemo(() => {
    if (audioTracks?.length) {
      return audioTracks.map((track, index) => ({
        id: `at-${track.index ?? index}`,
        title: track.title || track.language || `Audio ${index + 1}`,
        type: 'index',
        value: track.index ?? index,
        raw: track,
      }));
    }
    return manifestAudio;
  }, [audioTracks, manifestAudio]);

  const textList = useMemo(
    () =>
      (textTracks || []).map((track, index) => ({
        id: `tt-${track.index ?? index}`,
        title: track.title || track.language || `CC ${index + 1}`,
        type: track.language ? 'language' : 'index',
        value: track.language || track.index || index,
        raw: track,
      })),
    [textTracks],
  );

  useEffect(() => {
    if (!audioList.length) {
      return;
    }
    setDraftAudioId((prev) => {
      if (prev && audioList.some((item) => item.id === prev)) {
        return prev;
      }
      return matchAudioId(audioList, selectedAudioTrack);
    });
  }, [audioList, selectedAudioTrack]);

  useEffect(() => {
    setDraftTextId((prev) => {
      if (prev != null && (prev === 'off' || prev === 'system' || textList.some((item) => item.id === prev))) {
        return prev;
      }
      return matchTextId(textList, selectedTextTrack);
    });
  }, [textList, selectedTextTrack]);

  const selectedSpeedLabel = useMemo(() => `${formatSpeed(draftSpeed)}x`, [draftSpeed]);

  const selectedSpeedId = useMemo(() => {
    const hit = SPEED_PRESETS.find((speed) => Math.abs(draftSpeed - speed) < 0.001);
    return hit != null ? String(hit) : null;
  }, [draftSpeed]);

  const qualityItems = useMemo(
    () => [
      {id: 'recommended', name: labels.recommended || 'Auto'},
      ...qualities.map((item) => ({
        id: item.id,
        name: item.detail ? `${item.label} · ${item.detail}` : item.label,
        quality: item,
      })),
    ],
    [qualities, labels.recommended],
  );

  const speedItems = useMemo(
    () =>
      SPEED_PRESETS.map((speed) => ({
        id: String(speed),
        name: `${formatSpeed(speed)}x`,
        speed,
      })),
    [],
  );

  const audioItems = useMemo(
    () =>
      audioList.map((item) => ({
        id: item.id,
        name: item.title,
        track: item,
      })),
    [audioList],
  );

  const textItems = useMemo(() => {
    const items = [{id: 'off', name: labels.off || 'Off'}];
    if (showSystemCaptions) {
      items.push({id: 'system', name: labels.systemCaptions || 'System captions'});
    }
    textList.forEach((item) => {
      items.push({
        id: item.id,
        name: item.title,
        track: item,
      });
    });
    return items;
  }, [textList, labels.off, labels.systemCaptions, showSystemCaptions]);

  const resizeItems = useMemo(
    () =>
      ['contain', 'cover', 'stretch'].map((mode) => ({
        id: mode,
        name: labels[mode] || mode,
      })),
    [labels],
  );

  const fontSizeItems = useMemo(
    () =>
      [12, 14, 16, 18, 20, 24, 28, 32].map((size) => ({
        id: String(size),
        name: `${size}`,
        size,
      })),
    [],
  );

  const subColorItems = useMemo(
    () =>
      [
        {id: '#FFFFFF', name: labels.subtitleColorWhite || 'White'},
        {id: '#F5C542', name: labels.subtitleColorYellow || 'Yellow'},
        {id: '#00E5FF', name: labels.subtitleColorCyan || 'Cyan'},
      ].map((c) => ({...c, color: c.id})),
    [labels.subtitleColorWhite, labels.subtitleColorYellow, labels.subtitleColorCyan],
  );

  const subBgItems = useMemo(
    () => [
      {
        id: 'transparent',
        name: labels.subtitleBgNone || 'None',
        bg: 'transparent',
      },
      {
        id: 'rgba(0,0,0,0.55)',
        name: labels.subtitleBgDark || 'Dark',
        bg: 'rgba(0,0,0,0.55)',
      },
      {
        id: 'rgba(0,0,0,0.85)',
        name: labels.subtitleBgSolid || 'Solid',
        bg: 'rgba(0,0,0,0.85)',
      },
    ],
    [labels.subtitleBgNone, labels.subtitleBgDark, labels.subtitleBgSolid],
  );

  const dismiss = () => {
    if (SPSheet?.hide) {
      SPSheet.hide();
    }
    onClose && onClose();
  };

  const applyAndClose = () => {
    if (dirty.speed && typeof onSpeedChange === 'function') {
      onSpeedChange(draftSpeed);
    }

    if (dirty.quality && showQuality && typeof onQualityChange === 'function') {
      if (draftQualityId === 'recommended') {
        onQualityChange(null, manifestAudio);
      } else {
        const quality = qualities.find((item) => item.id === draftQualityId);
        if (quality) {
          onQualityChange(quality, manifestAudio);
        }
      }
    }

    if (dirty.audio && showAudio && typeof onAudioTrackChange === 'function' && draftAudioId) {
      const track = audioList.find((item) => item.id === draftAudioId);
      if (track) {
        onAudioTrackChange({type: track.type, value: track.value}, track.raw);
      }
    }

    if (dirty.text && showSubtitles && typeof onSubtitleChange === 'function') {
      if (!draftTextId || draftTextId === 'off') {
        onSubtitleChange({type: 'disabled'}, null);
      } else if (draftTextId === 'system') {
        onSubtitleChange({type: 'system'}, null);
      } else {
        const track = textList.find((item) => item.id === draftTextId);
        if (track) {
          onSubtitleChange({type: track.type, value: track.value}, track.raw);
        }
      }
    }

    if (dirty.resize && showResizeMode && typeof onResizeModeChange === 'function' && draftResize) {
      onResizeModeChange(draftResize);
    }

    if (dirty.font && showSubtitleStyle && typeof onSubtitleStyleChange === 'function') {
      onSubtitleStyleChange({
        ...(subtitleStyle || {}),
        fontSize: draftFontSize,
        color: draftSubColor,
        backgroundColor: draftSubBg,
      });
    }

    dismiss();
  };

  // FlatList rows — more reliable vertical scrolling inside SPSheet/Modal than ScrollView.
  const rows = useMemo(() => {
    const list = [];

    list.push({
      key: 'speed',
      node: (
        <Section label={labels.playbackSpeed}>
          <Text style={[styles.speedValue, {color: accentColor}]}>{selectedSpeedLabel}</Text>
          <View style={styles.sliderRow}>
            <TouchableOpacity
              onPress={() => {
                markDirty('speed');
                setDraftSpeed((v) => Math.max(Number((v - 0.05).toFixed(2)), 0.25));
              }}
              style={styles.stepButton}
            >
              <Text style={styles.stepText}>−</Text>
            </TouchableOpacity>
            <Slider
              style={styles.slider}
              minimumValue={0.25}
              maximumValue={2}
              step={0.05}
              value={draftSpeed}
              onValueChange={(value) => {
                markDirty('speed');
                setDraftSpeed(Number(value.toFixed(2)));
              }}
              minimumTrackTintColor={accentColor}
              maximumTrackTintColor="#3f3f46"
              thumbTintColor={accentColor}
            />
            <TouchableOpacity
              onPress={() => {
                markDirty('speed');
                setDraftSpeed((v) => Math.min(Number((v + 0.05).toFixed(2)), 2));
              }}
              style={styles.stepButton}
            >
              <Text style={styles.stepText}>+</Text>
            </TouchableOpacity>
          </View>
          <ChipMenu
            items={speedItems}
            selected={selectedSpeedId}
            accentColor={accentColor}
            onPress={(item) => {
              markDirty('speed');
              setDraftSpeed(item.speed);
            }}
          />
        </Section>
      ),
    });

    if (showQuality) {
      list.push({
        key: 'quality',
        node: (
          <Section label={labels.videoQuality}>
            {loadingQualities ? (
              <Text style={styles.hint}>{labels.qualitiesLoading}</Text>
            ) : qualities.length === 0 ? (
              <Text style={styles.hint}>{labels.qualitiesEmpty}</Text>
            ) : (
              <ChipMenu
                items={qualityItems}
                selected={draftQualityId}
                accentColor={accentColor}
                onPress={(item) => {
                  markDirty('quality');
                  setDraftQualityId(item.id);
                }}
              />
            )}
          </Section>
        ),
      });
    }

    if (showAudio) {
      list.push({
        key: 'audio',
        node: (
          <Section label={labels.audio}>
            {audioItems.length === 0 ? (
              <Text style={styles.hint}>{labels.off}</Text>
            ) : (
              <ChipMenu
                items={audioItems}
                selected={draftAudioId}
                accentColor={accentColor}
                onPress={(item) => {
                  markDirty('audio');
                  setDraftAudioId(item.id);
                }}
              />
            )}
          </Section>
        ),
      });
    }

    if (showSubtitles) {
      list.push({
        key: 'subs',
        node: (
          <Section label={labels.subtitles}>
            <ChipMenu
              items={textItems}
              selected={draftTextId || 'off'}
              accentColor={accentColor}
              onPress={(item) => {
                markDirty('text');
                setDraftTextId(item.id);
              }}
            />
          </Section>
        ),
      });
    }

    if (showResizeMode && onResizeModeChange) {
      list.push({
        key: 'fit',
        node: (
          <Section label={labels.resizeMode}>
            <ChipMenu
              items={resizeItems}
              selected={draftResize}
              accentColor={accentColor}
              onPress={(item) => {
                markDirty('resize');
                setDraftResize(item.id);
              }}
            />
          </Section>
        ),
      });
    }

    if (showSubtitleStyle && onSubtitleStyleChange) {
      list.push({
        key: 'sub-font',
        node: (
          <Section label={labels.subtitleFontSize || labels.subtitleStyle}>
            <ChipMenu
              items={fontSizeItems}
              selected={String(draftFontSize)}
              accentColor={accentColor}
              onPress={(item) => {
                markDirty('font');
                setDraftFontSize(item.size);
              }}
            />
          </Section>
        ),
      });
      list.push({
        key: 'sub-color',
        node: (
          <Section label={labels.subtitleColor || 'Subtitle color'}>
            <ChipMenu
              items={subColorItems}
              selected={draftSubColor}
              accentColor={accentColor}
              onPress={(item) => {
                markDirty('font');
                setDraftSubColor(item.color);
              }}
            />
          </Section>
        ),
      });
      list.push({
        key: 'sub-bg',
        node: (
          <Section label={labels.subtitleBackground || 'Subtitle background'}>
            <ChipMenu
              items={subBgItems}
              selected={draftSubBg}
              accentColor={accentColor}
              onPress={(item) => {
                markDirty('font');
                setDraftSubBg(item.bg);
              }}
            />
          </Section>
        ),
      });
    }

    return list;
  }, [
    labels,
    accentColor,
    selectedSpeedLabel,
    draftSpeed,
    speedItems,
    selectedSpeedId,
    showQuality,
    loadingQualities,
    qualities.length,
    qualityItems,
    draftQualityId,
    showAudio,
    audioItems,
    draftAudioId,
    showSubtitles,
    textItems,
    draftTextId,
    showResizeMode,
    onResizeModeChange,
    resizeItems,
    draftResize,
    showSubtitleStyle,
    onSubtitleStyleChange,
    fontSizeItems,
    draftFontSize,
    subColorItems,
    draftSubColor,
    subBgItems,
    draftSubBg,
    labels.subtitleFontSize,
    labels.subtitleColor,
    labels.subtitleBackground,
  ]);

  return (
    <GestureHandlerRootView
      style={[styles.root, {height: sheetHeight}]}
      testID="soul-settings-modal"
      onLayout={() => {
        SPSheet?.reportContentHeight?.(sheetHeight);
      }}
    >
      <View style={styles.handle} />
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {labels.settingsTitle || labels.settings}
        </Text>
        <TouchableOpacity testID="soul-settings-close" onPress={dismiss} hitSlop={12}>
          <Text style={styles.headerCloseText}>{labels.close}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={({item}) => item.node}
        style={styles.bodyList}
        contentContainerStyle={styles.bodyContent}
        ListFooterComponent={<View style={{height: 28}} />}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="always"
        bounces
        nestedScrollEnabled
        removeClippedSubviews={false}
      />

      <TouchableOpacity
        testID="soul-settings-done"
        onPress={applyAndClose}
        style={[styles.doneButton, {backgroundColor: accentColor}]}
      >
        <Text style={styles.doneText}>{labels.done}</Text>
      </TouchableOpacity>
    </GestureHandlerRootView>
  );
};

export const openSettingsSheet = (props) => {
  if (!SPSheet?.show) {
    console.warn(
      '[SoulPlayer] @sekizlipenguen/react-native-popup-confirm-toast is required for settings sheet. Wrap app with <Root>.',
    );
    return false;
  }
  const sheetHeight = props?.sheetHeight || resolveSheetHeight();
  SPSheet.show({
    autoHeight: false,
    height: sheetHeight,
    maxHeight: sheetHeight,
    dragTopOnly: true,
    closeOnPressMask: true,
    // Must stay false — sheet drag steals FlatList pans.
    closeOnDragDown: false,
    animation: 'slide',
    from: 'bottom',
    onCloseComplete: () => props.onClose && props.onClose(),
    customStyles: {
      container: {
        backgroundColor: SHEET_BG,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
      },
      keyboardGapFill: {
        backgroundColor: SHEET_BG,
      },
      draggableIcon: {
        backgroundColor: '#52525b',
      },
      draggableContainer: {
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        overflow: 'hidden',
      },
    },
    component: () => <SettingsMenu {...props} />,
  });
  return true;
};

export const closeSettingsSheet = () => {
  SPSheet?.hide?.();
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: SHEET_BG,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#52525b',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexShrink: 0,
  },
  sheetTitle: {
    color: '#fafafa',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  headerCloseText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '600',
  },
  bodyList: {
    flex: 1,
  },
  bodyContent: {
    // Keep last section (subtitle style) clear of sticky Done button.
    paddingBottom: 48,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
    includeFontPadding: false,
  },
  speedValue: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  slider: {flex: 1, marginHorizontal: 6},
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {color: '#fff', fontSize: 20, fontWeight: '600'},
  scrollMenuContainer: {
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginLeft: 0,
  },
  scrollMenuContent: {
    paddingRight: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  chip: {
    backgroundColor: '#2a2a2a',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  chipText: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
  },
  chipTextActive: {
    color: '#111',
    fontWeight: '800',
  },
  hint: {color: '#71717a', fontSize: 13, lineHeight: 18},
  doneButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexShrink: 0,
  },
  doneText: {color: '#111', fontSize: 16, fontWeight: '800'},
});

export default SettingsMenu;
