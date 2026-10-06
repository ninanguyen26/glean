import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { C } from '../spike/effects';
import { ItemGlyph } from './ItemGlyph';
import { GameItem } from './items';
import { getActiveSeason, getSeenItemIds } from './db';

/* Phase 7: seasonal silhouette album — seen items in full color, the rest as silhouettes. */

const RARITY_COLOR: Record<string, string> = {
  common: '#8A7B68',
  uncommon: '#5B9BD5',
  rare: '#E8A13D',
};

export function AlbumScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<GameItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const season = getActiveSeason();

  useEffect(() => {
    if (!season) return;
    // the grid comes straight from the bundled seed (always present);
    // only the seen-set needs the DB
    setItems(season.items.map((it) => ({ ...it, region: 'seasonal', season: season.id } as GameItem)));
    try {
      setSeen(new Set(getSeenItemIds()));
    } catch {
      // unseen until the DB is reachable
    }
  }, []);

  if (!season) {
    return (
      <View style={styles.root}>
        <Text style={styles.empty}>No season right now.</Text>
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹ Map</Text>
        </Pressable>
      </View>
    );
  }

  const found = items.filter((i) => seen.has(i.id)).length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Map</Text>
      </Pressable>
      <Text style={styles.title}>{season.name} album</Text>
      <Text style={styles.sub}>
        {found}/{items.length} found
      </Text>
      <View style={styles.grid}>
        {items.map((it) => {
          const isSeen = seen.has(it.id);
          return (
            <View key={it.id} style={styles.cell}>
              <ItemGlyph def={it} size={52} silhouette={!isSeen} />
              <Text style={styles.name}>{isSeen ? it.name : '???'}</Text>
              {isSeen && it.rarity && (
                <Text style={[styles.rarity, { color: RARITY_COLOR[it.rarity] }]}>{it.rarity}</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.footnote}>Seasonal finds appear on the belt — rares get likelier the longer they hide.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingTop: 72, paddingHorizontal: 28, paddingBottom: 40 },
  back: { marginBottom: 14 },
  backText: { fontSize: 16, fontWeight: '700', color: C.sub },
  title: { fontSize: 30, fontWeight: '900', color: C.ink },
  sub: { fontSize: 14, color: C.sub, marginTop: 4, fontWeight: '600' },
  empty: { fontSize: 16, color: C.sub, textAlign: 'center', marginTop: 120 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 12 },
  cell: {
    width: '30%',
    aspectRatio: 0.85,
    backgroundColor: '#FFFDF8',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  name: { fontSize: 11, fontWeight: '700', color: C.ink, textAlign: 'center', marginTop: 6 },
  rarity: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  footnote: { fontSize: 12, color: C.sub, fontStyle: 'italic', marginTop: 24, lineHeight: 18 },
});
