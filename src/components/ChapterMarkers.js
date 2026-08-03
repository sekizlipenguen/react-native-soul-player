import React from 'react';
import {Pressable, StyleSheet} from 'react-native';

/**
 * Progress chapter markers (tap → seek).
 * Used by ProgressBar; exported for custom bottom bars.
 */
const ChapterMarkers = ({
  chapters = [],
  duration = 0,
  accentColor = '#F5C542',
  onChapterPress,
  onSeek,
}) => {
  if (!chapters?.length || !duration) {
    return null;
  }
  return chapters.map((chapter, index) => {
    if (chapter.time == null) {
      return null;
    }
    const left = `${Math.min(100, Math.max(0, (chapter.time / duration) * 100))}%`;
    return (
      <Pressable
        key={chapter.id || `c-${index}`}
        hitSlop={10}
        onPress={() => {
          if (onChapterPress) {
            onChapterPress(chapter);
          } else if (onSeek) {
            onSeek(chapter.time);
          }
        }}
        style={[styles.marker, {left, backgroundColor: accentColor}]}
        accessibilityLabel={chapter.title || `Chapter ${index + 1}`}
      />
    );
  });
};

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    top: 8,
    width: 4,
    height: 12,
    borderRadius: 1,
    marginLeft: -2,
    zIndex: 3,
  },
});

export default ChapterMarkers;
