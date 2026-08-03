import React from 'react';
import {Linking, Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {formatLabel} from '../i18n';

const formatClock = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? `0${s}` : s}`;
};

/**
 * Minimal top-anchored ad chrome (badge / learn more / progress / skip).
 * Stays clear of the video mid-frame — no bottom-docked skip strip.
 */
const AdOverlay = ({
  labels,
  accentColor = '#F5C542',
  canSkip,
  countdown,
  currentTime = 0,
  duration = 0,
  podIndex = 0,
  podTotal = 1,
  clickThroughUrl,
  onSkip,
  onClick,
  edgeInsets = {top: 0, right: 0, bottom: 0, left: 0},
}) => {
  const remaining = Math.max(0, (duration || 0) - (currentTime || 0));
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const showSkipCountdown = !canSkip && countdown != null && countdown > 0;
  const podLabel = formatLabel(labels.adCountdown || labels.ad || 'Ad · {current}/{total}', {
    current: podIndex + 1,
    total: Math.max(podTotal, 1),
  });

  const skipControl = canSkip ? (
    <Pressable
      testID="soul-ad-skip"
      accessibilityRole="button"
      accessibilityLabel={labels.skipAd || 'Skip ad'}
      onPress={onSkip}
      hitSlop={10}
      style={({pressed}) => [
        styles.skipBtn,
        {
          backgroundColor: pressed ? 'rgba(245,197,66,0.5)' : 'rgba(245,197,66,0.72)',
          borderColor: accentColor,
        },
      ]}
    >
      <Text style={styles.skipText}>{labels.skipAd || 'Skip ad'}</Text>
      <Text style={styles.skipChevron}>›</Text>
    </Pressable>
  ) : showSkipCountdown ? (
    <View style={styles.countdownPill} testID="soul-ad-skip-countdown">
      <Text style={styles.countdownText}>
        {formatLabel(labels.skipIn || 'Skip in {seconds}s', {seconds: countdown})}
      </Text>
    </View>
  ) : (
    <View style={styles.countdownPill} testID="soul-ad-unskippable">
      <Text style={styles.countdownText}>{labels.ad || 'Ad'}</Text>
    </View>
  );

  return (
    <View
      style={[
        styles.wrap,
        {
          // Match TopBar: FS uses safe-area; inline stays flush to the player top edge.
          paddingTop: (edgeInsets.top || 0) > 0 ? (edgeInsets.top || 0) + 6 : 6,
          paddingLeft: 8 + (edgeInsets.left || 0),
          paddingRight: 8 + (edgeInsets.right || 0),
        },
      ]}
      pointerEvents="box-none"
      testID="soul-ad-overlay"
      collapsable={false}
    >
      <View style={styles.topChrome} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={styles.badgeRow}>
            <Text style={styles.badge} testID="soul-ad-badge">
              {podLabel}
            </Text>
            {duration > 0 ? (
              <Text style={styles.remaining} testID="soul-ad-remaining">
                {formatLabel(labels.adRemaining || '{time}', {
                  time: formatClock(remaining),
                })}
              </Text>
            ) : null}
          </View>

          {clickThroughUrl ? (
            <TouchableOpacity
              testID="soul-ad-learn-more"
              onPress={() => {
                onClick && onClick();
                Linking.openURL(clickThroughUrl).catch(() => {});
              }}
              style={styles.learnMore}
              activeOpacity={0.85}
            >
              <Text style={[styles.learnMoreText, {color: accentColor}]}>
                {labels.learnMore || 'Learn more'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.progressTrack} testID="soul-ad-progress">
          <View
            style={[
              styles.progressFill,
              {width: `${progress * 100}%`, backgroundColor: accentColor},
            ]}
          />
        </View>

        <View style={styles.actionRow} pointerEvents="box-none">
          <Text style={styles.clockHint} testID="soul-ad-clock">
            {duration > 0
              ? `${formatClock(currentTime)} / ${formatClock(duration)}`
              : labels.ad || 'Ad'}
          </Text>
          {skipControl}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    zIndex: 200,
    elevation: 200,
  },
  topChrome: {
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    overflow: 'hidden',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  remaining: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    overflow: 'hidden',
    fontWeight: '700',
    fontSize: 11,
  },
  learnMore: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  learnMoreText: {
    fontWeight: '800',
    fontSize: 12,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  clockHint: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
    flexShrink: 1,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 5,
    minHeight: 34,
    borderWidth: 1.5,
  },
  skipText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  skipChevron: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    marginLeft: 4,
    marginTop: -1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  countdownPill: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    minHeight: 34,
    justifyContent: 'center',
  },
  countdownText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default AdOverlay;
