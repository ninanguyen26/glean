import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { C } from '../spike/effects';
import { getAllRegions, getActiveSeason, ProgressSnapshot } from './db';

/* Phase 6: world map — city cards with stars, locks, workweek dots, endless. */

export function MapScreen({
  progress,
  onSelectCity,
  onEndless,
  onAlbum,
}: {
  progress: ProgressSnapshot;
  onSelectCity: (cityId: string) => void;
  onEndless: () => void;
  onAlbum: () => void;
}) {
  const regions = getAllRegions();
  const season = getActiveSeason();
  return (
    <View style={styles.root}>
      <Text style={styles.title}>GLEAN</Text>
      <Text style={styles.sub}>{progress.totalStars} ★ earned</Text>

      {season && (
        <Pressable onPress={onAlbum} style={styles.seasonBanner}>
          <Text style={styles.seasonText}>
            ❄ {season.name} is here — {season.items.length} seasonal finds
          </Text>
          <Text style={styles.seasonGo}>album ›</Text>
        </Pressable>
      )}

      {regions.map((r) => {
        const p = progress.cities.find((c) => c.id === r.id)!;
        const locked = !p.unlocked;
        return (
          <Pressable
            key={r.id}
            onPress={() => !locked && onSelectCity(r.id)}
            style={[styles.card, locked && styles.cardLocked]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cityName}>{r.name}</Text>
              <Text style={styles.stars}>{locked ? '🔒' : `${p.stars} ★`}</Text>
            </View>
            <Text style={styles.blurb}>{locked ? `Unlocks at ${r.unlockStars} ★` : r.blurb}</Text>
            {!locked && (
              <View style={styles.dots}>
                {p.dayBest.map((s, i) => (
                  <View key={i} style={[styles.dot, s > 0 && styles.dotDone]}>
                    {s > 0 && <Text style={styles.dotStar}>★</Text>}
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => progress.endlessUnlocked && onEndless()}
        style={[styles.card, styles.endlessCard, !progress.endlessUnlocked && styles.cardLocked]}
      >
        <View style={styles.cardTop}>
          <Text style={styles.cityName}>Endless</Text>
          <Text style={styles.stars}>{progress.endlessUnlocked ? `best ${progress.endlessBest}` : '🔒'}</Text>
        </View>
        <Text style={styles.blurb}>
          {progress.endlessUnlocked
            ? 'Score attack — 3 misses and the run is over'
            : "Finish Portland's week to unlock"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: 72, paddingHorizontal: 28 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: 8, color: C.ink, textAlign: 'center' },
  sub: { textAlign: 'center', fontSize: 14, color: C.sub, marginTop: 6, marginBottom: 16, fontWeight: '600' },
  seasonBanner: {
    backgroundColor: '#DCE9F5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seasonText: { fontSize: 14, fontWeight: '700', color: '#4A6B8A' },
  seasonGo: { fontSize: 14, fontWeight: '800', color: '#4A6B8A' },
  card: {
    backgroundColor: '#FFFDF8',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardLocked: { opacity: 0.55 },
  endlessCard: { borderWidth: 2, borderColor: C.gold, borderStyle: 'dashed' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cityName: { fontSize: 20, fontWeight: '800', color: C.ink },
  stars: { fontSize: 16, fontWeight: '800', color: C.gold },
  blurb: { fontSize: 13, color: C.sub, marginTop: 4, fontStyle: 'italic' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFE6D2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotDone: { backgroundColor: C.gold },
  dotStar: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
