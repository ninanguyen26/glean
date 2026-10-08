import { useEffect } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
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
import { getActiveSeason } from "./db";
import { tapFeedback } from "./feel";
import { BINS, RegionDef } from "./items";
import { LifetimeHud } from "./LifetimeHud";
import {
  BIN_SPRITES,
  ICON_AUTUMN,
  ICON_BACK,
  ICON_PIN,
  ICON_RULEBOOK,
  ICON_SPRING,
  ICON_START,
  ICON_SUMMER,
  ICON_WINTER,
  PORTLAND_BG,
} from "./sprites";

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
  globalDay,
  onStart,
  onBack,
}: {
  region: RegionDef;
  day: number;
  globalDay: number;
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

  const activeSeason = getActiveSeason();
  const seasonIcon = activeSeason
    ? {
        spring: ICON_SPRING,
        summer: ICON_SUMMER,
        fall: ICON_AUTUMN,
        winter: ICON_WINTER,
      }[activeSeason.id]
    : null;

  const body = (
    <>
      <View>
        <View style={styles.topRow}>
          <View style={styles.lifetimeHud}>
            <LifetimeHud />
          </View>
          <Pressable
            onPress={() => {
              tapFeedback();
              playTap();
              onBack();
            }}
            style={styles.back}
            hitSlop={10}
          >
            <Image
              source={ICON_BACK}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
        <View style={styles.pillRow}>
          <View style={styles.paperPill}>
            {seasonIcon && (
              <Image
                source={seasonIcon}
                style={styles.pillIcon}
                resizeMode="contain"
              />
            )}
            <Text style={styles.pillText}>Day {globalDay}</Text>
          </View>
          <View style={styles.paperPill}>
            <Image
              source={ICON_PIN}
              style={styles.pillIcon}
              resizeMode="contain"
            />
            <Text style={styles.pillText}>{region.name.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <View style={styles.bottomGroup}>
        <View style={styles.card}>
          <ScrollView
            style={styles.cardScroll}
            showsVerticalScrollIndicator={false}
          >
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
          </ScrollView>
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
      </View>
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
  root: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  bottomGroup: {
    position: "absolute",
    left: 32,
    right: 32,
    bottom: 0,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  lifetimeHud: {
    height: 36,
    justifyContent: "center",
  },
  back: { padding: 4 },
  backIcon: { width: 42, height: 42 },
  pillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paperPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.oat,
    borderWidth: 2,
    borderColor: palette.bark,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    height: 32,
  },
  pillIcon: { width: 21, height: 21, marginRight: 8 },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.bark,
  },
  card: {
    backgroundColor: palette.paper,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: palette.bark,
    padding: 20,
    height: 530,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardScroll: {
    flex: 1,
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
    paddingTop: 18,
    borderColor: palette.bark,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  binImage: { width: 65, height: 65 },
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
    bottom: 30,
  },
  startIcon: { width: 400, height: 160 },
});
