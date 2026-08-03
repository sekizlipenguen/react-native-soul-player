import React, {useMemo, useRef, useState} from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import {Root} from '@sekizlipenguen/react-native-popup-confirm-toast';
import SoulPlayer from '@sekizlipenguen/react-native-soul-player';
import type {SoulPlayerRef} from '@sekizlipenguen/react-native-soul-player';

type DemoSource = {
  id: string;
  label: string;
  url: string;
  type?: string;
};

/**
 * Public demo URLs verified 200/206 (Google gtv-videos-bucket is 403).
 * Ads = short MP4s; content = HLS masters + one MP4.
 */
const AD_CREATIVES = {
  flower:
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  friday:
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
  bunny10s:
    'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  sample5s: 'https://samplelib.com/preview/mp4/sample-5s.mp4',
};

const SOURCES: DemoSource[] = [
  {
    id: 'hls',
    label: 'HLS Mux (BBB)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    type: 'm3u8',
  },
  {
    id: 'hls-apple',
    label: 'HLS Apple (quality)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    type: 'm3u8',
  },
  {
    // 2 audio (BipBop Audio 1/2) + EN/FR/ES/JA subtitles (forced + full)
    id: 'hls-audio-subs',
    label: 'HLS Apple (audio+subs)',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    type: 'm3u8',
  },
  {
    id: 'hls-tos',
    label: 'HLS Tears of Steel',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    type: 'm3u8',
  },
  {
    id: 'mp4',
    label: 'MP4 Big Buck Bunny',
    url: 'https://cdn.jsdelivr.net/gh/mediaelement/mediaelement-files@master/big_buck_bunny.mp4',
    type: 'mp4',
  },
];

const DEMO_ADS = {
  enabled: true as const,
  pod: true,
  vast: true,
  companion: false,
  breaks: [
    {
      id: 'pre',
      position: 'preroll' as const,
      creatives: [
        {url: AD_CREATIVES.flower, type: 'mp4'},
        {url: AD_CREATIVES.sample5s, type: 'mp4'},
      ],
      skip: {mode: 'afterSeconds' as const, value: 3},
      clickThroughUrl: 'https://github.com/sekizlipenguen',
    },
    {
      id: 'mid-10',
      position: 10,
      urls: [AD_CREATIVES.friday, AD_CREATIVES.bunny10s],
      type: 'mp4',
      skip: {mode: 'afterSeconds' as const, value: 5},
      clickThroughUrl: 'https://github.com/sekizlipenguen/react-native-soul-player',
    },
    {
      id: 'mid-45',
      position: 45,
      url: AD_CREATIVES.bunny10s,
      type: 'mp4',
      skip: {mode: 'never' as const},
    },
    {
      id: 'post',
      position: 'postroll' as const,
      url: AD_CREATIVES.flower,
      type: 'mp4',
      skip: {mode: 'afterPercent' as const, value: 50},
    },
  ],
};

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <Root>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor="#0B1F3A"
        />
        <SafeAreaView
          style={styles.safe}
          edges={['top', 'right', 'bottom', 'left']}
          testID="soul-player-example">
          <AppContent />
        </SafeAreaView>
      </Root>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const playerRef = useRef<SoulPlayerRef>(null);
  const {width: windowWidth} = useWindowDimensions();
  const [sourceId, setSourceId] = useState(SOURCES[0].id);
  const [paused, setPaused] = useState(false);
  const [info, setInfo] = useState('Ready — ads off, cover fit');
  const [showLabels, setShowLabels] = useState(true);
  const [adsOn, setAdsOn] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  // Mid-layout probe: fixed 16:9 box so any black strip is inside the player,
  // not confused with SafeArea / gesture / flex:1 fill.
  const playerHeight = Math.round((windowWidth * 9) / 16);

  const source = useMemo(
    () => SOURCES.find(item => item.id === sourceId) ?? SOURCES[0],
    [sourceId],
  );

  const reloadPlayer = (reason: string) => {
    setPaused(false);
    setPlayerKey(k => k + 1);
    setInfo(reason);
  };

  const demoTextTracks = useMemo(
    () => [
      {
        title: 'English CC',
        language: 'en',
        type: 'text/vtt',
        uri: 'https://cdn.jsdelivr.net/gh/videojs/video.js@v7.21.1/docs/examples/elephantsdream/captions.en.vtt',
      },
    ],
    [],
  );

  const demoControls = useMemo(
    () => ({
      showLabels,
      back: true,
      cast: true,
      doubleTapSeek: true,
      doubleTapPlayPause: true,
      holdToSpeed: true,
      swipeVolume: true,
      swipeBrightness: true,
      chapters: true,
      endScreen: true,
      titleOverlay: true,
      audioTrackPicker: true,
      subtitlePicker: true,
      subtitleStyle: true,
      systemCaptions: true,
      lock: true,
      pip: true,
      sleepTimer: true,
      share: true,
      debugOverlay: false,
      autoHide: false,
    }),
    [showLabels],
  );

  const demoChapters = useMemo(
    () => [
      {id: 'c1', time: 10, title: 'Midroll cue'},
      {id: 'c2', time: 45, title: 'No-skip mid'},
      {id: 'c3', time: 120, title: '2m'},
    ],
    [],
  );

  const demoEndScreen = useMemo(
    () => [
      {id: 'again', title: 'Watch again'},
      {id: 'hls', title: 'Try HLS'},
      {id: 'docs', title: 'GitHub'},
    ],
    [],
  );

  const demoTheme = useMemo(
    () => ({
      accentColor: '#F5C542',
      controlColor: '#fff',
      trackColor: '#666',
    }),
    [],
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      testID="app-scroll"
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.eyebrow} testID="app-eyebrow">
          @sekizlipenguen/react-native-soul-player
        </Text>
        <Text style={styles.title} testID="app-title">
          Soul Player Example
        </Text>
        <Text style={styles.body} testID="app-body">
          Default HLS Mux. Ads: preroll pod → mid @10s → mid @45s → postroll.
          Use “HLS Apple (audio+subs)” for 2 audio tracks + multi-language
          subtitles (EN/FR/ES/JA).
        </Text>

        <View style={styles.row}>
          {SOURCES.map(item => (
            <Pressable
              key={item.id}
              testID={`source-${item.id}`}
              style={[styles.chip, sourceId === item.id && styles.chipActive]}
              onPress={() => {
                setSourceId(item.id);
                reloadPlayer(`Source: ${item.label}`);
              }}>
              <Text
                style={[
                  styles.chipText,
                  sourceId === item.id && styles.chipTextActive,
                ]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <Pressable
            testID="btn-ads-toggle"
            accessibilityLabel={adsOn ? 'Ads ON' : 'Ads OFF'}
            accessibilityRole="button"
            accessibilityState={{selected: adsOn}}
            style={[styles.button, adsOn && styles.buttonActive]}
            onPress={() => {
              const next = !adsOn;
              setAdsOn(next);
              reloadPlayer(next ? 'Ads ON — preroll…' : 'Ads OFF');
            }}>
            <Text style={styles.buttonText} accessible={false}>
              {adsOn ? 'Ads ON' : 'Ads OFF'}
            </Text>
          </Pressable>
          <Pressable
            testID="btn-seek-mid"
            style={styles.button}
            onPress={() => {
              playerRef.current?.seek?.(12);
              setInfo('Seek → 12s (should gate midroll @10s if not played)');
            }}>
            <Text style={styles.buttonText}>Seek mid 10s</Text>
          </Pressable>
          <Pressable
            testID="btn-seek-mid45"
            style={styles.button}
            onPress={() => {
              playerRef.current?.seek?.(46);
              setInfo('Seek → 46s (midroll @45s, skip never)');
            }}>
            <Text style={styles.buttonText}>Seek mid 45s</Text>
          </Pressable>
          <Pressable
            testID="btn-replay-ads"
            style={styles.button}
            onPress={() => reloadPlayer('Player remount — ads reset, preroll…')}>
            <Text style={styles.buttonText}>Replay ads</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable
            testID="btn-toggle-pause"
            style={styles.button}
            onPress={() => setPaused(value => !value)}>
            <Text style={styles.buttonText}>{paused ? 'Play' : 'Pause'}</Text>
          </Pressable>
          <Pressable
            testID="btn-info"
            style={styles.button}
            onPress={() => {
              const snapshot = playerRef.current?.getInfo();
              setInfo(
                snapshot
                  ? `t=${snapshot.currentTime.toFixed(1)}s / ${snapshot.duration.toFixed(1)}s ad=${snapshot.isAdPlaying}`
                  : 'No player info',
              );
            }}>
            <Text style={styles.buttonText}>Get info</Text>
          </Pressable>
          <Pressable
            testID="btn-labels"
            style={styles.button}
            onPress={() => setShowLabels(value => !value)}>
            <Text style={styles.buttonText}>
              {showLabels ? 'Icons only' : 'Show labels'}
            </Text>
          </Pressable>
          <Pressable
            testID="btn-hide-chrome"
            accessibilityLabel="Hide chrome"
            style={styles.button}
            onPress={() => playerRef.current?.hideChrome?.()}>
            <Text style={styles.buttonText}>Hide chrome</Text>
          </Pressable>
          <Pressable
            testID="btn-show-chrome"
            accessibilityLabel="Show chrome"
            style={styles.button}
            onPress={() => playerRef.current?.showChrome?.()}>
            <Text style={styles.buttonText}>Show chrome</Text>
          </Pressable>
        </View>
        <Text style={styles.status} testID="app-status">
          {info}
        </Text>
      </View>

      <Text style={styles.probeLabel} testID="probe-above-player">
        — above player (layout probe) —
      </Text>

      <View style={[styles.playerWrap, {height: playerHeight}]}>
        <SoulPlayer
          key={`player-${playerKey}-${sourceId}-${adsOn ? 'ads' : 'noads'}`}
          ref={playerRef}
          videoUrl={source.url}
          videoType={source.type}
          title={source.label}
          description="Demo: ads + chapters + settings + i18n"
          paused={paused}
          locale="auto"
          showBackButton
          showCastButton
          resizeMode="cover"
          fullscreenMode="immersive"
          enterFullscreenOnRotate
          exitFullscreenOnPortrait
          textTracks={demoTextTracks}
          controls={demoControls}
          onShare={async query => {
            const url = `${source.url}${query}`;
            setInfo(`Share ${query}`);
            await Share.share(
              {message: url, url, title: source.label},
              {dialogTitle: source.label},
            );
          }}
          chapters={demoChapters}
          endScreenItems={demoEndScreen}
          ads={
            adsOn
              ? DEMO_ADS
              : {
                  enabled: false,
                  breaks: [],
                }
          }
          onBackButton={() => setInfo('Back pressed')}
          onPlay={time => setInfo(`Playing @ ${time.toFixed(1)}s`)}
          onPause={time => setInfo(`Paused @ ${time.toFixed(1)}s`)}
          onFullScreenEnter={() => setInfo('Fullscreen enter')}
          onFullScreenExit={() => setInfo('Fullscreen exit')}
          onSettingsOpen={() => setInfo('Settings open')}
          onSettingsClose={() => setInfo('Settings close')}
          onAdBreakStart={brk =>
            setInfo(`Ad START: ${brk?.id || brk?.position}`)
          }
          onAdBreakEnd={brk => setInfo(`Ad END: ${brk?.id || brk?.position}`)}
          onAdSkip={brk => setInfo(`Ad SKIP: ${brk?.id || brk?.position}`)}
          onAdError={(err, brk) => {
            const anyErr = err as
              | {errorString?: string; message?: string}
              | undefined;
            setInfo(
              `Ad ERROR (${brk?.id || '?'}): ${
                anyErr?.errorString || anyErr?.message || JSON.stringify(err)
              }`,
            );
          }}
          onEnd={() => setInfo('Content ended')}
          onError={error => setInfo(`Error: ${JSON.stringify(error)}`)}
          onEndScreenAction={item => {
            const action = item as {id?: string; title?: string};
            if (action?.id === 'hls') {
              setSourceId('hls');
              reloadPlayer('End screen → HLS');
              return;
            }
            if (action?.id === 'again') {
              reloadPlayer('End screen → replay');
              return;
            }
            setInfo(`End action: ${action?.title || action?.id}`);
          }}
          theme={demoTheme}
          style={styles.player}
        />
      </View>

      <View style={styles.belowPlayer} testID="probe-below-player">
        <Text style={styles.probeLabel}>— below player (layout probe) —</Text>
        <Text style={styles.probeBody}>
          If a black strip sits between the timestamps and THIS yellow line, the
          bug is inside SoulPlayer — not SafeArea / gesture / flex fill.
        </Text>
        <Text style={styles.probeBody}>
          Lorem probe A — empty filler so the player sits mid-scroll.
        </Text>
        <Text style={styles.probeBody}>
          Lorem probe B — scroll past the player; chrome should stay in its box.
        </Text>
        <Text style={styles.probeBody}>
          Lorem probe C — no extra black should leak into this navy section.
        </Text>
        <Text style={styles.probeMarker} testID="probe-yellow-line">
          ▬▬▬ yellow marker under player ▬▬▬
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B1F3A',
  },
  root: {
    flex: 1,
    backgroundColor: '#0B1F3A',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F5C542',
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: '#d1d5db',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4b5563',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#111827',
  },
  chipActive: {
    backgroundColor: '#F5C542',
    borderColor: '#F5C542',
  },
  chipText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0B1F3A',
  },
  button: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonActive: {
    backgroundColor: '#854d0e',
  },
  buttonText: {
    color: '#F5C542',
    fontWeight: '700',
    fontSize: 12,
  },
  status: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  probeLabel: {
    color: '#F5C542',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  belowPlayer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    backgroundColor: '#0B1F3A',
  },
  probeBody: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  probeMarker: {
    marginTop: 8,
    color: '#F5C542',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  playerWrap: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  player: {
    flex: 1,
  },
});

export default App;
