import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { C } from '../spike/effects';
import { RegionDef } from './items';
import { ShiftResult } from './BeltScreen';

/* Phase 6: shift summary — stars, accuracy, today's lesson, continue/replay. */

export function SummaryScreen({
  result,
  region,
  onContinue,
  onReplay,
}: {
  result: ShiftResult;
  region: RegionDef | null; // null = endless run
  onContinue: () => void;
  onReplay: () => void;
}) {
  const accuracy = result.total > 0 ? result.correct / result.total : 0;
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.kicker}>{region ? `${region.name} — SHIFT COMPLETE` : 'ENDLESS — RUN OVER'}</Text>
        {region ? (
          <Text style={styles.stars}>{'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</Text>
        ) : (
          <Text style={styles.score}>{result.score}</Text>
        )}
        {result.newBest && <Text style={styles.newBest}>NEW BEST!</Text>}
        {region && (
          <>
            <Text style={styles.line}>Accuracy  {Math.round(accuracy * 100)}%</Text>
            <Text style={styles.line}>Best streak  ×{result.bestStreak}</Text>
            <Text style={styles.line}>Missed  {result.missed}</Text>
          </>
        )}
        {!region && <Text style={styles.line}>Best streak  ×{result.bestStreak}</Text>}
        {result.lessons.length > 0 && (
          <View style={styles.lessons}>
            <Text style={styles.lessonsTitle}>TODAY'S LESSON</Text>
            {result.lessons.map((l, i) => (
              <Text key={i} style={styles.lesson}>•  {l}</Text>
            ))}
          </View>
        )}
        <Pressable onPress={onContinue} style={styles.primary}>
          <Text style={styles.primaryText}>{region ? 'Back to map' : 'Back to map'}</Text>
        </Pressable>
        <Pressable onPress={onReplay} style={styles.secondary}>
          <Text style={styles.secondaryText}>{region ? 'Run it again' : 'New run'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  card: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: C.sub, textAlign: 'center' },
  stars: { fontSize: 44, color: C.gold, marginVertical: 12 },
  score: { fontSize: 64, fontWeight: '900', color: C.ink, marginVertical: 8 },
  newBest: { fontSize: 15, fontWeight: '800', color: C.gold, letterSpacing: 2, marginBottom: 8 },
  line: { fontSize: 16, color: C.ink, marginTop: 4, fontWeight: '600' },
  lessons: {
    marginTop: 16,
    backgroundColor: '#FAF3E8',
    borderRadius: 12,
    padding: 14,
    width: '100%',
  },
  lessonsTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: C.sub, marginBottom: 6 },
  lesson: { fontSize: 13, color: C.ink, marginTop: 4, lineHeight: 19, fontWeight: '600' },
  primary: {
    marginTop: 20,
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingHorizontal: 26,
    paddingVertical: 13,
    width: '100%',
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: { marginTop: 10, paddingVertical: 10 },
  secondaryText: { color: C.sub, fontWeight: '700', fontSize: 14 },
});
