import React, {useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';

const SOURCES = {
  top: require('../styles/img/top-vignette.png'),
  bottom: require('../styles/img/bottom-vignette.png'),
};

/**
 * Soft edge fade behind chrome icons.
 * Only the PNG alpha gradient — a flat rgba wash looked like a solid grey slab
 * and broke the transparent falloff.
 */
export default function ChromeVignette({
  edge = 'top',
  style,
  contentStyle,
  children,
  pointerEvents = 'box-none',
}) {
  const [box, setBox] = useState({width: 0, height: 0});
  const source = SOURCES[edge] || SOURCES.top;

  return (
    <View
      style={[styles.wrap, edge === 'bottom' && styles.wrapBottom, style]}
      pointerEvents={pointerEvents}
      onLayout={(e) => {
        const {width, height} = e.nativeEvent.layout;
        const w = Math.ceil(width);
        const h = Math.ceil(height);
        if (w > 0 && h > 0 && (w !== box.width || h !== box.height)) {
          setBox({width: w, height: h});
        }
      }}
    >
      {box.width > 0 && box.height > 0 ? (
        <Image
          source={source}
          pointerEvents="none"
          resizeMode="stretch"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            top: 0,
            left: -1,
            width: box.width + 2,
            height: box.height,
          }}
        />
      ) : null}
      <View style={[styles.content, contentStyle]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'stretch',
  },
  wrapBottom: {
    justifyContent: 'flex-end',
  },
  content: {
    position: 'relative',
    width: '100%',
  },
});
