import { useEffect } from "react";
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
import { tapFeedback } from "./feel";
import { HOME_BG, ICON_ALBUM, ICON_MAP, ICON_PLAY } from "./sprites";

/* Home: MRF background, HUD on top, play icon bottom-center,
   map/album as edge buttons growing out of the right side. */

export function HomeScreen({
  onPlay,
  onMap,
  onAlbum,
}: {
  onPlay: () => void;
  onMap: () => void;
  onAlbum: () => void;
}) {
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

  return (
    <ImageBackground source={HOME_BG} style={styles.root} resizeMode="cover">
      <View style={styles.hud}>
        <LifetimeHud />
      </View>

      <View style={styles.spacer} />

      {/* bottom edge pills: map grows out left, album grows out right */}
      <View style={styles.bottomRow}>
        <View style={styles.edgeLeft}>
          <Pressable
            onPress={onMap}
            style={[styles.edgePill, styles.edgePillLeft]}
          >
            <Text style={styles.edgeLabel}>MAP</Text>
            <Image
              source={ICON_MAP}
              style={styles.edgeIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            tapFeedback();
            playTap();
            onPlay();
          }}
        >
          <Animated.View style={playStyle}>
            <Image
              source={ICON_PLAY}
              style={styles.playIcon}
              resizeMode="contain"
            />
          </Animated.View>
        </Pressable>
        <View style={styles.edgeRight}>
          <Pressable onPress={onAlbum} style={styles.edgePill}>
            <Image
              source={ICON_ALBUM}
              style={styles.edgeIcon}
              resizeMode="contain"
            />
            <Text style={styles.edgeLabel}>ALBUM</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  spacer: { flex: 1 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 100,
  },
  edgeLeft: { marginLeft: -24 },
  edgeRight: { marginRight: -24 },
  edgePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: 132,
    backgroundColor: palette.sand,
    borderWidth: 2,
    borderColor: palette.bark,
    borderRadius: 22,
    paddingVertical: 8,
    paddingRight: 24,
  },
  edgePillLeft: {
    paddingRight: 0,
    paddingLeft: 24,
  },
  edgeIcon: { width: 28, height: 28, opacity: 0.75 },
  edgeLabel: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "rgba(90,74,58,0.8)",
  },
  playIcon: { width: 104, height: 104 },
});
