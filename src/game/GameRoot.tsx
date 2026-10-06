import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../spike/effects';
import { MapScreen } from './MapScreen';
import { RulesScreen } from './RulesScreen';
import { SummaryScreen } from './SummaryScreen';
import { AlbumScreen } from './AlbumScreen';
import { BeltScreen, ShiftResult } from './BeltScreen';
import {
  DAY_LABELS,
  getRegionDef,
  getActiveSeason,
  bumpRarePity,
  loadProgress,
  ProgressSnapshot,
  recordShiftResult,
  recordEndlessBest,
} from './db';

/* Phase 6: progression shell nav — map -> rules -> shift -> summary. */

type Screen =
  | { name: 'map' }
  | { name: 'rules'; city: string }
  | { name: 'shift'; city: string; day: number; key: number }
  | { name: 'endless'; key: number }
  | { name: 'album' }
  | { name: 'summary'; result: ShiftResult; city: string | null; day: number };

export function GameRoot() {
  const [screen, setScreen] = useState<Screen>({ name: 'map' });
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);

  const refresh = () => setProgress(loadProgress());
  useEffect(refresh, []);

  // soft pity: a shift with no rare seasonal sighting raises the odds
  const pityBump = (sawRare: boolean) => {
    const season = getActiveSeason();
    if (season && !sawRare) bumpRarePity(season.id);
  };

  if (!progress) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  switch (screen.name) {
    case 'map':
      return (
        <MapScreen
          progress={progress}
          onSelectCity={(cityId) => setScreen({ name: 'rules', city: cityId })}
          onEndless={() => setScreen({ name: 'endless', key: 0 })}
          onAlbum={() => setScreen({ name: 'album' })}
        />
      );
    case 'album':
      return <AlbumScreen onBack={() => setScreen({ name: 'map' })} />;
    case 'rules': {
      const region = getRegionDef(screen.city);
      const p = progress.cities.find((c) => c.id === screen.city)!;
      return (
        <RulesScreen
          region={region}
          day={p.nextDay}
          onStart={() => setScreen({ name: 'shift', city: screen.city, day: p.nextDay, key: 0 })}
          onBack={() => setScreen({ name: 'map' })}
        />
      );
    }
    case 'shift': {
      const region = getRegionDef(screen.city);
      const title = `${region.name.toUpperCase()} — ${DAY_LABELS[screen.day - 1]}`;
      return (
        <BeltScreen
          key={`shift-${screen.city}-${screen.day}-${screen.key}`}
          regionId={screen.city}
          title={title}
          onShiftEnd={(result) => {
            recordShiftResult(screen.city, screen.day, result.stars, result.correct, result.total);
            pityBump(result.sawRare);
            refresh();
            setScreen({ name: 'summary', result, city: screen.city, day: screen.day });
          }}
          onQuit={() => {
            refresh();
            setScreen({ name: 'map' });
          }}
        />
      );
    }
    case 'endless': {
      const unlockedIds = progress.cities.filter((c) => c.unlocked).map((c) => c.id);
      return (
        <BeltScreen
          key={`endless-${screen.key}`}
          regionId={unlockedIds}
          title="ENDLESS"
          endless
          onShiftEnd={(result) => {
            const newBest = recordEndlessBest(result.score);
            pityBump(result.sawRare);
            refresh();
            setScreen({ name: 'summary', result: { ...result, newBest }, city: null, day: 0 });
          }}
          onQuit={() => {
            refresh();
            setScreen({ name: 'map' });
          }}
        />
      );
    }
    case 'summary': {
      const region = screen.city ? getRegionDef(screen.city) : null;
      return (
        <SummaryScreen
          result={screen.result}
          region={region}
          onContinue={() => {
            refresh();
            setScreen({ name: 'map' });
          }}
          onReplay={() =>
            screen.city
              ? setScreen({ name: 'shift', city: screen.city, day: screen.day, key: Date.now() })
              : setScreen({ name: 'endless', key: Date.now() })
          }
        />
      );
    }
  }
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 17, fontWeight: '700', color: C.sub },
});
