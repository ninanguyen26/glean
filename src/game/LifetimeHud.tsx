import { Image, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { palette } from "../constants/theme";
import { getCash, getTotalStars } from "./db";
import { ICON_COIN, ICON_STAR } from "./sprites";

/* Top row: lifetime numbers (cash / total stars). Paper-tag pills,
 * identical on Home, Rules, and Belt. Values shrink to fit when long.
 * cashOverride/starsOverride pin the display (summary reward flight
 * starts at the pre-shift totals); cashPulse/starsPulse pop the pill
 * when incremented. */
export function LifetimeHud({
  cashOverride,
  starsOverride,
  cashPulse,
  starsPulse,
}: {
  cashOverride?: number;
  starsOverride?: number;
  cashPulse?: number;
  starsPulse?: number;
}) {
  const cashScale = useSharedValue(1);
  const starsScale = useSharedValue(1);
  useEffect(() => {
    if (cashPulse) {
      cashScale.value = withSequence(
        withTiming(1.18, { duration: 110 }),
        withTiming(1, { duration: 170 })
      );
    }
  }, [cashPulse]);
  useEffect(() => {
    if (starsPulse) {
      starsScale.value = withSequence(
        withTiming(1.18, { duration: 110 }),
        withTiming(1, { duration: 170 })
      );
    }
  }, [starsPulse]);
  const cashAnim = useAnimatedStyle(() => ({
    transform: [{ scale: cashScale.value }],
  }));
  const starsAnim = useAnimatedStyle(() => ({
    transform: [{ scale: starsScale.value }],
  }));
  return (
    <View style={styles.row}>
      <Animated.View style={[styles.pill, cashAnim]}>
        <Image source={ICON_COIN} style={styles.icon} resizeMode="contain" />
        <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit>
          {cashOverride ?? getCash()}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.pill, starsAnim]}>
        <Image source={ICON_STAR} style={styles.icon} resizeMode="contain" />
        <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit>
          {starsOverride ?? getTotalStars()}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    width: 115,
    backgroundColor: palette.oat,
    borderWidth: 2,
    borderColor: palette.bark,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  icon: { width: 22, height: 22 },
  text: {
    flex: 1,
    marginLeft: 6,
    textAlign: "right",
    color: palette.bark,
    fontWeight: "800",
    fontSize: 13,
  },
  textCenter: {
    flex: 0,
    marginLeft: 0,
    textAlign: "center",
  },
});
