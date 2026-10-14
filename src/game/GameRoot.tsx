import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  playBeltMusic,
  playMainMusic,
  setMusicMuted,
  setSoundMuted,
} from '../audio/sounds';
import { getSetting, setSetting } from './db';
import { setHapticsMuted } from './feel';
import { palette } from '../constants/theme';
import { HomeScreen } from './HomeScreen';
import { OnboardingScreen } from './OnboardingScreen';
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
import { preloadAssets } from './assetPreload';
import {
  APP_START_ASSETS,
  BELT_SCREEN_ASSETS,
  HOME_SCREEN_ASSETS,
  RULES_SCREEN_ASSETS,
} from './sprites';

/* Phase 6: progression shell nav — map -> rules -> shift -> summary.
   The album is a modal overlay, not a screen, so home/map stays behind it. */

type Screen =
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'rules'; city: string }
  | { name: 'shift'; city: string; day: number; key: number }
  | { name: 'endless'; key: number }
  | { name: 'summary'; result: ShiftResult; city: string | null; day: number };

type LoadingState = { label: string; progress: number };

const screenLoadProgress = (done: number, total: number) =>
  total <= 0 ? 1 : Math.min(1, 0.75 + (done / total) * 0.25);

export function GameRoot() {
  const [screen, setScreen] = useState<Screen>(() =>
    getSetting('onboarding_seen') === '1' ? { name: 'home' } : { name: 'onboarding' },
  );
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [rewardsReady, setRewardsReady] = useState(false);
  const [hudTick, setHudTick] = useState(0);
  const [bootReady, setBootReady] = useState(false);
  const [loading, setLoading] = useState<LoadingState | null>(null);
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
  const loadAssetGroup = async (
    label: string,
    sources: any[],
    options?: { keepVisible?: boolean },
  ) => {
    setLoading({ label, progress: 0 });
    await preloadAssets(sources, (done, total) => {
      setLoading({ label, progress: total === 0 ? 1 : done / total });
    });
    if (!options?.keepVisible) {
      setLoading(null);
    }
  };
  const showRules = async (cityId: string) => {
    if (loading) return;
    await loadAssetGroup("Loading rules", RULES_SCREEN_ASSETS, {
      keepVisible: true,
    });
    setScreen({ name: 'rules', city: cityId });
  };
  const showHome = async () => {
    if (loading) return;
    await loadAssetGroup("Loading home", HOME_SCREEN_ASSETS, {
      keepVisible: true,
    });
    setScreen({ name: 'home' });
  };
  const showShift = async (cityId: string, day: number, key = 0) => {
    if (loading) return;
    await loadAssetGroup("Loading shift", BELT_SCREEN_ASSETS, {
      keepVisible: true,
    });
    setScreen({ name: 'shift', city: cityId, day, key });
  };
  const showEndless = async (key = 0) => {
    if (loading) return;
    await loadAssetGroup("Loading shift", BELT_SCREEN_ASSETS, {
      keepVisible: true,
    });
    setScreen({ name: 'endless', key });
  };
  const handleRulesAssetsProgress = useCallback((done: number, total: number) => {
    const progress = screenLoadProgress(done, total);
    setLoading((prev) => {
      if (
        prev?.label === "Loading rules" &&
        Math.abs(prev.progress - progress) < 0.001
      ) {
        return prev;
      }
      return { label: "Loading rules", progress };
    });
  }, []);
  const handleRulesAssetsReady = useCallback(() => {
    setLoading(null);
  }, []);
  const handleHomeAssetsProgress = useCallback((done: number, total: number) => {
    const progress = screenLoadProgress(done, total);
    setLoading((prev) => {
      if (
        prev?.label === "Loading home" &&
        Math.abs(prev.progress - progress) < 0.001
      ) {
        return prev;
      }
      return { label: "Loading home", progress };
    });
  }, []);
  const handleHomeAssetsReady = useCallback(() => {
    setLoading(null);
  }, []);
  const handleBeltAssetsProgress = useCallback((done: number, total: number) => {
    const progress = screenLoadProgress(done, total);
    setLoading((prev) => {
      if (
        prev?.label === "Loading shift" &&
        Math.abs(prev.progress - progress) < 0.001
      ) {
        return prev;
      }
      return { label: "Loading shift", progress };
    });
  }, []);
  const handleBeltAssetsReady = useCallback(() => {
    setLoading(null);
  }, []);
  useEffect(() => {
    refresh();
    // restore persisted audio/haptic prefs before any music starts
    setSoundMuted(getSetting('sound_muted') === '1');
    setHapticsMuted(getSetting('haptics_muted') === '1');
    setMusicMuted(getSetting('music_muted') === '1');
    let alive = true;
    setLoading({ label: "Loading", progress: 0 });
    preloadAssets(APP_START_ASSETS, (done, total) => {
      if (alive) {
        setLoading({
          label: "Loading",
          progress: total === 0 ? 1 : done / total,
        });
      }
    }).finally(() => {
      if (alive) {
        setBootReady(true);
        if (screen.name === 'home') {
          setLoading({ label: "Loading home", progress: 0.75 });
        } else {
          setLoading(null);
        }
      }
    });
    return () => {
      alive = false;
    };
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

  if (!progress || !bootReady) {
    return (
      <LoadingScreen loading={loading} />
    );
  }

  let content: React.ReactNode;
  switch (screen.name) {
    case 'onboarding': {
      content = (
        <OnboardingScreen
          onDone={() => {
            setSetting('onboarding_seen', '1');
            void showHome();
          }}
        />
      );
      break;
    }
    case 'home': {
      // play: persisted selected city (falls back to first unlocked)
      const playCity =
        progress.cities.find((c) => c.id === selectedCity && c.unlocked) ??
        progress.cities.find((c) => c.unlocked);
      content = (
        <HomeScreen
          onPlay={() =>
            playCity
              ? void showRules(playCity.id)
              : undefined
          }
          onMap={() => {}}
          onAlbum={() => setAlbumOpen(true)}
          onSelectCity={(cityId) => {
            pickCity(cityId);
            void showRules(cityId);
          }}
          onEndless={() => void showEndless(0)}
          progress={progress}
          rewardsReady={rewardsReady}
          hudTick={hudTick}
          selectedCity={selectedCity}
          bgPaused={albumOpen}
          onAssetsProgress={handleHomeAssetsProgress}
          onAssetsReady={handleHomeAssetsReady}
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
          onStart={() => void showShift(screen.city, p.nextDay)}
          onBack={() => void showHome()}
          onAssetsProgress={handleRulesAssetsProgress}
          onAssetsReady={handleRulesAssetsReady}
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
            void showHome();
          }}
          onAssetsProgress={handleBeltAssetsProgress}
          onAssetsReady={handleBeltAssetsReady}
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
            void showHome();
          }}
          onAssetsProgress={handleBeltAssetsProgress}
          onAssetsReady={handleBeltAssetsReady}
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
          day={screen.day}
          onContinue={() => {
            refresh();
            void showHome();
          }}
          onReplay={() =>
            screen.city
              ? void showShift(screen.city, screen.day, Date.now())
              : void showEndless(Date.now())
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
      {loading && <LoadingScreen loading={loading} overlay />}
    </View>
  );
}

function LoadingScreen({
  loading,
  overlay,
}: {
  loading: LoadingState | null;
  overlay?: boolean;
}) {
  const progress = Math.max(0.04, Math.min(1, loading?.progress ?? 0));
  return (
    <View style={[styles.loading, overlay && styles.loadingOverlay]}>
      <Text style={styles.loadingText}>{loading?.label ?? "Loading"}</Text>
      <View style={styles.loadingBarTrack}>
        <View style={[styles.loadingBarFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: palette.paper,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 80,
  },
  loadingText: {
    fontFamily: 'BalsamiqSans_700Bold',
    fontSize: 17,
    fontWeight: '700',
    color: palette.bark,
    marginBottom: 14,
  },
  loadingBarTrack: {
    width: 220,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: palette.bark,
    backgroundColor: palette.oat,
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: palette.sage,
  },
});
