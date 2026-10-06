import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { C } from '../spike/effects';
import { BINS, RegionDef } from './items';
import { DAY_LABELS } from './db';

/* Phase 6: pre-shift rules card — streams, house rules, then start. */

export function RulesScreen({
  region,
  day,
  onStart,
  onBack,
}: {
  region: RegionDef;
  day: number;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.root}>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Map</Text>
      </Pressable>
      <Text style={styles.kicker}>{DAY_LABELS[day - 1]} SHIFT</Text>
      <Text style={styles.city}>{region.name}</Text>
      <Text style={styles.blurb}>{region.blurb}</Text>

      <View style={styles.streams}>
        {region.streams.map((s) => {
          const b = BINS.find((x) => x.id === s)!;
          return (
            <View key={s} style={[styles.stream, { backgroundColor: b.color }]}>
              <Text style={styles.streamLabel}>{b.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.rules}>
        <Text style={styles.rulesTitle}>HOUSE RULES</Text>
        {region.rules.map((r, i) => (
          <Text key={i} style={styles.rule}>•  {r}</Text>
        ))}
      </View>

      <Pressable onPress={onStart} style={styles.start}>
        <Text style={styles.startText}>Start shift</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: 72, paddingHorizontal: 32 },
  back: { marginBottom: 18 },
  backText: { fontSize: 16, fontWeight: '700', color: C.sub },
  kicker: { fontSize: 13, fontWeight: '700', letterSpacing: 3, color: C.sub },
  city: { fontSize: 38, fontWeight: '900', color: C.ink, marginTop: 4 },
  blurb: { fontSize: 15, color: C.sub, fontStyle: 'italic', marginTop: 6 },
  streams: { flexDirection: 'row', gap: 10, marginTop: 26 },
  stream: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  streamLabel: { color: '#fff', fontWeight: '800', fontSize: 14 },
  rules: {
    backgroundColor: '#FFFDF8',
    borderRadius: 18,
    padding: 20,
    marginTop: 26,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  rulesTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 2, color: C.sub, marginBottom: 10 },
  rule: { fontSize: 15, color: C.ink, marginTop: 8, fontWeight: '600', lineHeight: 22 },
  start: {
    marginTop: 30,
    backgroundColor: C.ink,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
