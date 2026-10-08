import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  playBeltMusic,
  playMainMusic,
  setMusicMuted,
  setSoundMuted,
} from '../audio/sounds';
import { getSetting } from './db';
import { setHapticsMuted } from './feel';
import { C } from '../spike/effects';
import { HomeScreen } from './HomeScreen';
import { RulesScreen } from './RulesScreen';
import { SummaryScreen } from './SummaryScreen';
import { AlbumScreen } from './AlbumScreen';
import { BeltScreen, ShiftResult } from './BeltScreen';
import {
  getRegionDef,
  getActiveSeason,
  bumpRarePity,
  loadProgress,
  ProgressSnapshot,
  recordShiftResult,
  recordEndlessBest,
  hasUnclaimedRewards,
  getSelectedCity,
  setSelectedCity,
} from './db';

/* Phase 6: progression shell nav — map -> rules -> shift -> summary.
   The album is a modal overlay, not a screen, so home/map stays behind it. */

type Screen =
  | { name: 'home' }
  | { name: 'rules'; city: string }
  | { name: 'shift'; city: string; day: number; key: number }
  | { name: 'endless'; key: number }
  | { name: 'summary'; result: ShiftResult; city: string | null; day: number };

export function GameRoot() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [rewardsReady, setRewardsReady] = useState(false);
  const [hudTick, setHudTick] = useState(0);
  // persisted city pick: map taps set it, unlocks auto-pick the new city,
  // endless never touches it.
  const [selectedCity, setSelectedCityState] = useState<string>(() => getSelectedCity());
  const pickCity = (id: string) => {
    setSelectedCity(id);
    setSelectedCityState(id);
  };

  // milestone rewards: refresh the home badge and HUD cash whenever the screen
  // changes or the album closes. Claims happen behind the modal scrim, so the
  // HUD only needs to be correct when home is revealed again; the tick forces
  // a re-render even when the badge state didn't flip (React would bail out).
  useEffect(() => {
    setRewardsReady(hasUnclaimedRewards());
    setHudTick((t) => t + 1);
  }, [screen, albumOpen]);

  const refresh = () => setProgress(loadProgress());
  useEffect(() => {
    refresh();
    // restore persisted audio/haptic prefs before any music starts
    setSoundMuted(getSetting('sound_muted') === '1');
    setHapticsMuted(getSetting('haptics_muted') === '1');
    setMusicMuted(getSetting('music_muted') === '1');
  }, []);

  // music: belt loop on the belt screen, main theme everywhere else
  useEffect(() => {
    if (!progress) return;
    if (screen.name === 'shift' || screen.name === 'endless') {
      playBeltMusic();
    } else {
      playMainMusic();
    }
  }, [screen.name, progress]);

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

  let content: React.ReactNode;
  switch (screen.name) {
    case 'home': {
      // play: persisted selected city (falls back to first unlocked)
      const playCity =
        progress.cities.find((c) => c.id === selectedCity && c.unlocked) ??
        progress.cities.find((c) => c.unlocked);
      content = (
        <HomeScreen
          onPlay={() =>
            playCity
              ? setScreen({ name: 'rules', city: playCity.id })
              : undefined
          }
          onMap={() => {}}
          onAlbum={() => setAlbumOpen(true)}
          onSelectCity={(cityId) => {
            pickCity(cityId);
            setScreen({ name: 'rules', city: cityId });
          }}
          onEndless={() => setScreen({ name: 'endless', key: 0 })}
          progress={progress}
          rewardsReady={rewardsReady}
          hudTick={hudTick}
          selectedCity={selectedCity}
          bgPaused={albumOpen}
        />
      );
      break;
    }
    case 'rules': {
      const region = getRegionDef(screen.city);
      const p = progress.cities.find((c) => c.id === screen.city)!;
      const globalDay =
        progress.cities.reduce((sum, c) => sum + (c.nextDay - 1), 0) + 1;
      content = (
        <RulesScreen
          region={region}
          day={p.nextDay}
          globalDay={globalDay}
          onStart={() =>
            setScreen({ name: 'shift', city: screen.city, day: p.nextDay, key: 0 })
          }
          onBack={() => setScreen({ name: 'home' })}
        />
      );
      break;
    }
    case 'shift': {
      const globalDay =
        progress.cities.reduce((sum, c) => sum + (c.nextDay - 1), 0) + 1;
      const title = `Day ${globalDay}`;
      content = (
        <BeltScreen
          key={`shift-${screen.city}-${screen.day}-${screen.key}`}
          regionId={screen.city}
          title={title}
          onShiftEnd={(result) => {
            // unlocks are derived from total stars, so diff the unlocked set
            // to auto-pick a newly unlocked city (manual picks stay sticky).
            const beforeUnlocked = new Set(
              progress.cities.filter((c) => c.unlocked).map((c) => c.id),
            );
            recordShiftResult(screen.city, screen.day, result.stars, result.correct, result.total);
            pityBump(result.sawRare);
            refresh();
            const after = loadProgress();
            const newly = after.cities.filter(
              (c) => c.unlocked && !beforeUnlocked.has(c.id),
            );
            if (newly.length > 0) pickCity(newly[newly.length - 1].id);
            setScreen({ name: 'summary', result, city: screen.city, day: screen.day });
          }}
          onQuit={() => {
            refresh();
            setScreen({ name: 'home' });
          }}
        />
      );
      break;
    }
    case 'endless': {
      const unlockedIds = progress.cities.filter((c) => c.unlocked).map((c) => c.id);
      content = (
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
            setScreen({ name: 'home' });
          }}
        />
      );
      break;
    }
    case 'summary': {
      const region = screen.city ? getRegionDef(screen.city) : null;
      content = (
        <SummaryScreen
          result={screen.result}
          region={region}
          onContinue={() => {
            refresh();
            setScreen({ name: 'home' });
          }}
          onReplay={() =>
            screen.city
              ? setScreen({ name: 'shift', city: screen.city, day: screen.day, key: Date.now() })
              : setScreen({ name: 'endless', key: Date.now() })
          }
        />
      );
      break;
    }
  }

  return (
    <View style={styles.root}>
      {content}
      {albumOpen && (
        <AlbumScreen
          onBack={() => setAlbumOpen(false)}
          onRewardsChanged={() => setHudTick((t) => t + 1)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 17, fontWeight: '700', color: C.sub },
});
