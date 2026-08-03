import React from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

const EndScreen = ({
  labels,
  accentColor = '#F5C542',
  items = [],
  onReplay,
  onNext,
  onAction,
  showNext = false,
}) => (
  <View style={styles.wrap} testID="soul-end-screen">
    <Text style={styles.title}>{labels.replay}</Text>
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.btn, {backgroundColor: accentColor}]}
        onPress={onReplay}
        testID="soul-end-replay"
      >
        <Text style={styles.btnText}>{labels.replay}</Text>
      </TouchableOpacity>
      {showNext ? (
        <TouchableOpacity style={styles.btnSecondary} onPress={onNext} testID="soul-end-next">
          <Text style={styles.btnSecondaryText}>{labels.next}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    {items?.length ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={item.id || index}
            style={styles.card}
            onPress={() => onAction && onAction(item)}
          >
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title || item.label || `#${index + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 35,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: '#111',
    fontWeight: '800',
  },
  btnSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#555',
  },
  btnSecondaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  row: {
    maxHeight: 100,
  },
  card: {
    width: 140,
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
  },
  cardTitle: {
    color: '#eee',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default EndScreen;
