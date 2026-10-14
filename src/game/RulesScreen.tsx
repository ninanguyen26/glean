import { useEffect, useState } from "react";
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
import { getTierCard } from "./db";
import { tapFeedback } from "./feel";
import { BINS, RegionDef } from "./items";
import { LifetimeHud } from "./LifetimeHud";
import { SettingsModal } from "./SettingsModal";
import {
  BIN_SPRITES,
  ICON_BACK,
  ICON_PIN,
  ICON_RULEBOOK,
  ICON_SETTINGS,
  ICON_START,
  PORTLAND_BG,
} from "./sprites";
import { useImageLoadGate } from "./useImageLoadGate";

/* Phase 6: pre-shift rules card — streams, house rules, then start. */

const HOUSE_RULES = [
  "Give dirty containers a rinse in the SINK",
  "Take multi-part items to PREP and pull them apart",
];

export function RulesScreen({
  region,
  onStart,
  onBack,
  onAssetsReady,
  onAssetsProgress,
}: {
  region: RegionDef;
  day: number;
  globalDay: number;
  onStart: () => void;
  onBack: () => void;
  onAssetsReady?: () => void;
  onAssetsProgress?: (done: number, total: number) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const tierCard = getTierCard(region.tier ?? "tier1");
  const markLoaded = useImageLoadGate({
    keys: [
      "settings",
      "back",
      "pin",
      "rulebook",
      "start",
      ...(region.id === "portland" ? ["background"] : []),
      ...region.streams.map((stream) => `bin-${stream}`),
    ],
    onReady: onAssetsReady,
    onProgress: onAssetsProgress,
  });

  const body = (
    <>
      <View>
        <View style={styles.topRow}>
          <View style={styles.lifetimeHud}>
            <LifetimeHud />
          </View>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => {
                tapFeedback();
                playTap();
                setSettingsOpen(true);
              }}
              style={styles.settings}
              hitSlop={8}
            >
              <Image
                source={ICON_SETTINGS}
                style={styles.settingsIcon}
                resizeMode="contain"
                onLoadEnd={() => markLoaded("settings")}
              />
            </Pressable>
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
                onLoadEnd={() => markLoaded("back")}
              />
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.bottomGroup}>
        <View style={styles.card}>
          <ScrollView
            style={styles.cardScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.cardHeader}>
              <Image
                source={ICON_PIN}
                style={styles.locationIcon}
                resizeMode="contain"
                onLoadEnd={() => markLoaded("pin")}
              />
              <Text style={styles.locationName}>{region.name}</Text>
            </View>
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
                        onLoadEnd={() => markLoaded(`bin-${s}`)}
                      />
                    </View>
                    <View style={styles.streamText}>
                      <Text style={styles.streamName}>{b.label}</Text>
                      <Text style={styles.streamItems}>
                        {tierCard.streams[s]}
                      </Text>
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
                onLoadEnd={() => markLoaded("rulebook")}
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
              onLoadEnd={() => markLoaded("start")}
            />
          </Animated.View>
        </Pressable>
      </View>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
  if (region.id === "portland") {
    return (
      <ImageBackground
        source={PORTLAND_BG}
        style={styles.root}
        resizeMode="cover"
        onLoadEnd={() => markLoaded("background")}
      >
        {body}
      </ImageBackground>
    );
  }
  return (
    <View style={[styles.root, { backgroundColor: palette.paper }]}>
      {body}
    </View>
  );
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
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  back: { padding: 4 },
  backIcon: { width: 42, height: 42 },
  card: {
    backgroundColor: palette.paper,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: palette.bark,
    padding: 21,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardScroll: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  locationIcon: { width: 24, height: 24 },
  locationName: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 18,
    fontWeight: "800",
    color: palette.bark,
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
    fontFamily: "BalsamiqSans_700Bold",
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
  streamName: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 16,
    fontWeight: "800",
    color: palette.bark,
  },
  streamItems: {
    fontSize: 11,
    color: palette.bark,
    fontWeight: "500",
    marginTop: 4,
    marginRight: 20,
    lineHeight: 16,
  },
  divider: {
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.fog,
    paddingBottom: 4,
  },
  rulesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  rulebookIcon: { width: 40, height: 40 },
  rulesTitle: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 17,
    fontWeight: "800",
    color: palette.bark,
  },
  rule: {
    fontSize: 11,
    color: palette.bark,
    marginTop: 8,
    fontWeight: "500",
    lineHeight: 16,
  },
  start: {
    alignItems: "center",
    bottom: 30,
  },
  startIcon: { width: 400, height: 160 },
});
