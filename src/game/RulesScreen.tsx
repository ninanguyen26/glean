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
import { C } from "../spike/effects";
import { DAY_LABELS } from "./db";
import { tapFeedback } from "./feel";
import { BINS, RegionDef } from "./items";
import { BIN_SPRITES, ICON_RULEBOOK, ICON_START, PORTLAND_BG } from "./sprites";

/* Phase 6: pre-shift rules card — streams, house rules, then start. */

const STREAM_ITEMS: Record<string, string> = {
  compost: "food scraps, soiled paper, yard waste",
  recycle: "paper, cardboard, glass & metal",
  landfill:
    "plastic of any color (black too — the sorters can't see it), stringy stuff (it jams the line), everything else",
};

const HOUSE_RULES = [
  "Rinse jars & cans before they recycle",
  "Bottles go to PREP first — cap off, label off, then sort the parts",
];

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
  // breathing scale for the start button (matches home play button)
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
  const startStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const body = (
    <>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Map</Text>
      </Pressable>
      <Text style={styles.kicker}>{DAY_LABELS[day - 1]} SHIFT</Text>
      <Text style={styles.city}>{region.name}</Text>
      <Text style={styles.blurb}>{region.blurb}</Text>

      <View style={styles.card}>
        <View style={styles.sectionPill}>
          <Text style={styles.sectionPillText}>WHAT GOES WHERE</Text>
        </View>
        {region.streams.map((s, i) => {
          const b = BINS.find((x) => x.id === s)!;
          return (
            <View key={s}>
              <View style={styles.streamRow}>
                <View style={styles.binBadge}>
                  <Image
                    source={BIN_SPRITES[s]}
                    style={styles.binImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.streamText}>
                  <Text style={styles.streamName}>{b.label}</Text>
                  <Text style={styles.streamItems}>{STREAM_ITEMS[s]}</Text>
                </View>
              </View>
              {i < region.streams.length - 1 ? (
                <View style={styles.divider} />
              ) : null}
            </View>
          );
        })}
        <View style={styles.divider} />
        <View style={styles.rulesHeader}>
          <Image
            source={ICON_RULEBOOK}
            style={styles.rulebookIcon}
            resizeMode="contain"
          />
          <Text style={styles.rulesTitle}>House Rules</Text>
        </View>
        {HOUSE_RULES.map((r, i) => (
          <Text key={i} style={styles.rule}>
            • {r}
          </Text>
        ))}
      </View>

      <Pressable
        onPress={() => {
          tapFeedback();
          playTap();
          onStart();
        }}
        style={styles.start}
      >
        <Animated.View style={startStyle}>
          <Image
            source={ICON_START}
            style={styles.startIcon}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>
    </>
  );
  if (region.id === "portland") {
    return (
      <ImageBackground
        source={PORTLAND_BG}
        style={styles.root}
        resizeMode="cover"
      >
        {body}
      </ImageBackground>
    );
  }
  return <View style={[styles.root, { backgroundColor: C.bg }]}>{body}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 72, paddingHorizontal: 32 },
  back: { marginBottom: 18 },
  backText: { fontSize: 16, fontWeight: "700", color: C.sub },
  kicker: { fontSize: 13, fontWeight: "700", letterSpacing: 3, color: C.sub },
  city: { fontSize: 38, fontWeight: "900", color: C.ink, marginTop: 4 },
  blurb: { fontSize: 15, color: C.sub, fontStyle: "italic", marginTop: 6 },
  card: {
    backgroundColor: palette.paper,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: palette.bark,
    padding: 20,
    marginTop: 26,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionPill: {
    alignSelf: "flex-start",
    backgroundColor: palette.sage,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
  },
  sectionPillText: {
    color: palette.bark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  streamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
  },
  binBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.sand,
    borderWidth: 2,
    borderColor: palette.bark,
    alignItems: "center",
    justifyContent: "center",
  },
  binImage: { width: 48, height: 48 },
  streamText: { flex: 1 },
  streamName: { fontSize: 16, fontWeight: "800", color: C.ink },
  streamItems: {
    fontSize: 12,
    color: C.sub,
    fontWeight: "600",
    marginTop: 4,
    lineHeight: 18,
  },
  divider: {
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D8C9AE",
    marginVertical: 6,
  },
  rulesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  rulebookIcon: { width: 40, height: 40 },
  rulesTitle: { fontSize: 17, fontWeight: "800", color: C.ink },
  rule: {
    fontSize: 12,
    color: C.ink,
    marginTop: 8,
    fontWeight: "600",
    lineHeight: 22,
  },
  start: {
    alignItems: "center",
    marginTop: -20,
  },
  startIcon: { width: 400, height: 160 },
});
