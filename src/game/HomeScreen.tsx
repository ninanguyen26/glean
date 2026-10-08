import { useEffect, useState } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { playTap } from "../audio/sounds";
import { palette } from "../constants/theme";
import { LifetimeHud } from "./LifetimeHud";
import { MapScreen } from "./MapScreen";
import { SettingsModal } from "./SettingsModal";
import { tapFeedback } from "./feel";
import {
  HOME_BG_FRAMES,
  ICON_ALBUM,
  ICON_MAP,
  ICON_PLAY,
  ICON_SETTINGS,
} from "./sprites";

/* Home: MRF background, HUD on top, play icon bottom-center,
   map/album as edge buttons growing out of the right side. */

export function HomeScreen({
  onPlay,
  onMap,
  onAlbum,
  onSelectCity,
  onEndless,
  progress,
  rewardsReady,
  hudTick,
}: {
  onPlay: () => void;
  onMap: () => void;
  onAlbum: () => void;
  onSelectCity: (cityId: string) => void;
  onEndless: () => void;
  progress: any;
  rewardsReady: boolean;
  hudTick: number; // refresh token: bumps whenever HUD values may have changed
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  // 8-frame MRF background loop (12fps)
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setFrame((f) => (f + 1) % HOME_BG_FRAMES.length),
      1000 / 12,
    );
    return () => clearInterval(t);
  }, []);

  // breathing scale for the play button
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, []);
  const playStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // flashing "!" badge on the album button while milestone rewards wait
  const badgePulse = useSharedValue(1);
  useEffect(() => {
    badgePulse.value = withRepeat(withTiming(0.3, { duration: 850 }), -1, true);
  }, []);
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgePulse.value,
  }));

  return (
    <ImageBackground
      source={HOME_BG_FRAMES[frame]}
      style={styles.root}
      resizeMode="cover"
      fadeDuration={0}
    >
      <View style={styles.topRow}>
        <View style={styles.hud}>
          <LifetimeHud key={hudTick} />
        </View>
        <Pressable
          style={styles.settings}
          onPress={() => {
            tapFeedback();
            playTap();
            setSettingsOpen(true);
          }}
          hitSlop={8}
        >
          <Image
            source={ICON_SETTINGS}
            style={styles.settingsIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>

      <View style={styles.spacer} />

      <Pressable
        onPress={() => {
          tapFeedback();
          playTap();
          onPlay();
        }}
        style={styles.playWrap}
      >
        <Animated.View style={playStyle}>
          <Image
            source={ICON_PLAY}
            style={styles.playIcon}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>

      <View style={styles.bottomRow}>
        <View style={styles.menuItem}>
          <Pressable
            onPress={() => {
              tapFeedback();
              playTap();
              setMapOpen(true);
            }}
            style={styles.menuButton}
          >
            <Image
              source={ICON_MAP}
              style={styles.menuIcon}
              resizeMode="contain"
            />
          </Pressable>
          <Text style={styles.menuLabel}>MODES</Text>
        </View>
        <View style={styles.menuItem}>
          <Pressable
            onPress={() => {
              tapFeedback();
              playTap();
              onAlbum();
            }}
            style={styles.menuButton}
          >
            <Image
              source={ICON_ALBUM}
              style={styles.menuIcon}
              resizeMode="contain"
            />
          </Pressable>
          {rewardsReady && (
            <Animated.View style={[styles.rewardBadge, badgeStyle]}>
              <Text style={styles.rewardBadgeText}>!</Text>
            </Animated.View>
          )}
          <Text style={styles.menuLabel}>ALBUM</Text>
        </View>
      </View>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {mapOpen && (
        <MapScreen
          progress={progress}
          onSelectCity={(cityId) => {
            setMapOpen(false);
            onSelectCity(cityId);
          }}
          onEndless={() => {
            setMapOpen(false);
            onEndless();
          }}
          onClose={() => setMapOpen(false)}
        />
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 42,
  },
  hud: {
    height: 36,
    justifyContent: "center",
  },
  settings: { padding: 4 },
  settingsIcon: {
    width: 42,
    height: 42,
    shadowColor: "#2E241C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  spacer: { flex: 1 },
  playWrap: {
    alignItems: "center",
    marginBottom: 28,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 56,
    paddingBottom: 120,
  },
  menuItem: {
    alignItems: "center",
  },
  menuButton: {
    width: 60,
    height: 60,
    borderRadius: 34,
    backgroundColor: palette.sand,
    borderWidth: 2,
    borderColor: palette.bark,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: {
    width: 39,
    height: 39,
    shadowColor: "#2E241C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  menuLabel: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: palette.bark,
  },
  rewardBadge: {
    position: "absolute",
    top: -4,
    right: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.clay,
    borderWidth: 2,
    borderColor: palette.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardBadgeText: {
    color: palette.cream,
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 18,
  },
  playIcon: { width: 104, height: 104 },
});
