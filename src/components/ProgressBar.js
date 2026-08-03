import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Slider from '@react-native-community/slider';
import ChapterMarkers from './ChapterMarkers';

/**
 * Scrub commits on release / tap so midroll ad gates are not bypassed by
 * intermediate onValueChange jumps during a drag.
 */
const ProgressBar = ({
  currentTime = 0,
  duration = 0,
  accentColor = '#F5C542',
  trackColor = '#666',
  tapToSeek = true,
  scrubbing = true,
  onSeek,
  onSeekStart,
  onSeekComplete,
  chapters = [],
  onChapterPress,
  disabled = false,
}) => {
  const widthRef = useRef(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(currentTime);

  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  const commitSeek = (value) => {
    if (disabled) {
      return;
    }
    onSeek && onSeek(value);
    onSeekComplete && onSeekComplete(value);
  };

  const seekFromX = (x) => {
    if (!duration || !widthRef.current || disabled) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, x / widthRef.current));
    commitSeek(ratio * duration);
  };

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
    >
      {tapToSeek ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={(e) => seekFromX(e.nativeEvent.locationX)}
          disabled={disabled}
        />
      ) : null}

      <ChapterMarkers
        chapters={chapters}
        duration={duration}
        accentColor={accentColor}
        onChapterPress={onChapterPress}
        onSeek={commitSeek}
      />

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration || 0}
        value={isScrubbing ? scrubValue : currentTime}
        disabled={disabled || !scrubbing}
        onSlidingStart={(value) => {
          setIsScrubbing(true);
          setScrubValue(value);
          onSeekStart && onSeekStart(value);
        }}
        onValueChange={(value) => {
          if (scrubbing) {
            setScrubValue(value);
          }
        }}
        onSlidingComplete={(value) => {
          setIsScrubbing(false);
          setScrubValue(value);
          if (scrubbing) {
            commitSeek(value);
          }
        }}
        minimumTrackTintColor={accentColor}
        maximumTrackTintColor={trackColor}
        thumbTintColor={accentColor}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 22,
    justifyContent: 'center',
  },
  slider: {
    width: '100%',
    height: 22,
  },
});

export default ProgressBar;
