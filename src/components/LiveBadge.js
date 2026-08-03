import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';

const LiveBadge = ({labels, accentColor = '#E11', showGoToLive, onGoToLive}) => (
  <View style={styles.wrap} pointerEvents="box-none">
    <View style={[styles.badge, {backgroundColor: accentColor}]}>
      <Text style={styles.text}>{labels.live}</Text>
    </View>
    {showGoToLive ? (
      <TouchableOpacity style={styles.goLive} onPress={onGoToLive} testID="soul-go-live">
        <Text style={styles.goLiveText}>{labels.goToLive}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 56,
    left: 12,
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  text: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  goLive: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  goLiveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default LiveBadge;
