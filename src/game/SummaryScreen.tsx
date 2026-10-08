import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { playCoin, playStarTick } from "../audio/sounds";
import { palette } from "../constants/theme";
import { C } from "../spike/effects";
import { ShiftResult } from "./BeltScreen";
import { RegionDef } from "./items";
import { LifetimeHud } from "./LifetimeHud";
import {
  ICON_COIN,
  ICON_STAR,
  ICON_STAR_OUTLINE,
  PORTLAND_BG,
} from "./sprites";

/* Phase 6: shift summary — stars, accuracy, today's lesson, continue/replay.
 * Reward flight: the earned coin + stars fire together into the HUD pills,
 * ticking the counters up as each one lands. */

// pill geometry mirrors LifetimeHud (two 115-wide pills, 5pt gap, centered)
const PILL_W = 115;
const PILL_GAP = 5;

interface FlyerSpec {
  id: string;
  source: any;
  size: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  delay: number;
  duration: number;
  onLand: () => void;
}

function Flyer({ spec }: { spec: FlyerSpec }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      spec.delay,
      withTiming(
        1,
        { duration: spec.duration, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(spec.onLand)();
        },
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => {
    const e = t.value;
    const x = spec.sx + (spec.ex - spec.sx) * e - spec.size / 2;
    const y =
      spec.sy +
      (spec.ey - spec.sy) * e -
      Math.sin(e * Math.PI) * 44 -
      spec.size / 2;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: 1 - e * 0.35 },
      ],
      opacity: 1 - e * e * 0.5,
    };
  });
  return (
    <Animated.Image
      source={spec.source}
      resizeMode="contain"
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          width: spec.size,
          height: spec.size,
        },
        style,
      ]}
    />
  );
}

function tweenNumber(
  from: number,
  to: number,
  durMs: number,
  set: (n: number) => void,
) {
  const start = Date.now();
  const step = () => {
    const p = Math.min(1, (Date.now() - start) / durMs);
    set(Math.round(from + (to - from) * p));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function measureView(ref: { current: any }): Promise<{
  w: number;
  h: number;
  pageX: number;
  pageY: number;
}> {
  return new Promise((resolve) => {
    const node: any = ref.current;
    if (!node || !node.measure)
      return resolve({ w: 0, h: 0, pageX: 0, pageY: 0 });
    node.measure(
      (
        _x: number,
        _y: number,
        w: number,
        h: number,
        pageX: number,
        pageY: number,
      ) => resolve({ w, h, pageX, pageY }),
    );
  });
}

export function SummaryScreen({
  result,
  region,
  onContinue,
  onReplay,
}: {
  result: ShiftResult;
  region: RegionDef | null; // null = endless run
  onContinue: () => void;
  onReplay: () => void;
}) {
  const accuracy = result.total > 0 ? result.correct / result.total : 0;
  const [cashShown, setCashShown] = useState(result.cashBefore);
  const [starsShown, setStarsShown] = useState(result.starsBefore);
  const [cashPulse, setCashPulse] = useState(0);
  const [starsPulse, setStarsPulse] = useState(0);
  const [flyers, setFlyers] = useState<FlyerSpec[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);

  const rootRef = useRef<View>(null);
  const hudRowRef = useRef<View>(null);
  const earnedCoinRef = useRef<Image>(null);
  const scoreRef = useRef<Text>(null);
  const starsBoxRef = useRef<View>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      // no flight — jump straight to the final numbers
      setFlyers([]);
      setCashShown(result.cashBefore + result.cashEarned);
      setStarsShown(result.starsBefore + result.stars);
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = async () => {
      const root = await measureView(rootRef);
      const row = await measureView(hudRowRef);
      if (cancelled || row.w === 0) return;
      const rowW = PILL_W + PILL_GAP + PILL_W;
      const rowX = row.pageX + (row.w - rowW) / 2;
      const pillCY = row.pageY + row.h / 2;
      const ox = root.pageX;
      const oy = root.pageY;
      const specs: FlyerSpec[] = [];
      // coin: earned row (region) or big score (endless) -> cash pill
      if (result.cashEarned > 0) {
        const anchor = region
          ? await measureView(earnedCoinRef)
          : await measureView(scoreRef);
        if (!cancelled && anchor.w > 0) {
          specs.push({
            id: "coin",
            source: ICON_COIN,
            size: 30,
            sx: anchor.pageX + anchor.w / 2 - ox,
            sy: anchor.pageY + anchor.h / 2 - oy,
            ex: rowX + PILL_W / 2 - ox,
            ey: pillCY - oy,
            delay: 500,
            duration: 450,
            onLand: () => {
              setCashPulse((p) => p + 1);
              playCoin();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              tweenNumber(
                result.cashBefore,
                result.cashBefore + result.cashEarned,
                450,
                setCashShown,
              );
              setFlyers((f) => f.filter((s) => s.id !== "coin"));
            },
          });
        }
      }
      // stars: one per earned star -> star pill
      if (region && result.stars > 0) {
        const box = await measureView(starsBoxRef);
        if (!cancelled && box.w > 0) {
          for (let i = 0; i < result.stars; i++) {
            const idx = i;
            specs.push({
              id: `star-${idx}`,
              source: ICON_STAR,
              size: 40,
              sx:
                box.pageX +
                box.w / 2 -
                ox +
                (idx - (result.stars - 1) / 2) * 12,
              sy: box.pageY + box.h / 2 - oy,
              ex: rowX + PILL_W + PILL_GAP + PILL_W / 2 - ox,
              ey: pillCY - oy,
              delay: 500,
              duration: 450,
              onLand: () => {
                setStarsPulse((p) => p + 1);
                playStarTick();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStarsShown(result.starsBefore + idx + 1);
                setFlyers((f) => f.filter((s) => s.id !== `star-${idx}`));
                if (idx === result.stars - 1) {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                }
              },
            });
          }
        }
      }
      if (!cancelled) setFlyers(specs);
    };
    timers.push(setTimeout(run, 80));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reduceMotion]);

  const body = (
    <>
      <View style={styles.hud}>
        <View ref={hudRowRef} collapsable={false}>
          <LifetimeHud
            cashOverride={cashShown}
            starsOverride={starsShown}
            cashPulse={cashPulse}
            starsPulse={starsPulse}
          />
        </View>
      </View>
      <View style={styles.spacerTop} />
      <View style={styles.card}>
        <Text style={styles.kicker}>
          {region ? `${region.name} — SHIFT COMPLETE` : "ENDLESS — RUN OVER"}
        </Text>
        {region ? (
          <View ref={starsBoxRef} collapsable={false} style={styles.stars}>
            {[0, 1, 2].map((i) => (
              <Image
                key={i}
                source={i < result.stars ? ICON_STAR : ICON_STAR_OUTLINE}
                style={styles.starIcon}
                resizeMode="contain"
              />
            ))}
          </View>
        ) : (
          <Text ref={scoreRef} style={styles.score}>
            {result.score}
          </Text>
        )}
        {result.newBest && <Text style={styles.newBest}>NEW BEST!</Text>}
        {region && (
          <>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Accuracy</Text>
              <Text style={styles.statValue}>
                {Math.round(accuracy * 100)}%
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Best streak</Text>
              <Text style={styles.statValue}>
                ×{result.bestStreak}
                {result.bestStreak >= 20 ? " — PERFECT SHIFT!" : ""}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Missed</Text>
              <Text style={styles.statValue}>{result.missed}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statRow}>
              <View style={styles.statLabelRow}>
                <Image
                  ref={earnedCoinRef}
                  collapsable={false}
                  source={ICON_COIN}
                  style={styles.statIcon}
                  resizeMode="contain"
                />
                <Text style={styles.statLabel}>Earned</Text>
              </View>
              <Text style={styles.statValue}>${result.cashEarned}</Text>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statLabelRow}>
                <Image
                  source={ICON_COIN}
                  style={styles.statIcon}
                  resizeMode="contain"
                />
                <Text style={styles.statLabel}>Streak bonus</Text>
              </View>
              <Text style={styles.statValue}>+${result.streakBonus}</Text>
            </View>
          </>
        )}
        {!region && (
          <Text style={styles.line}>Best streak ×{result.bestStreak}</Text>
        )}
        {/* {result.lessons.length > 0 && (
          <View style={styles.lessons}>
            <Text style={styles.lessonsTitle}>TODAY'S LESSON</Text>
            {result.lessons.map((l, i) => (
              <Text key={i} style={styles.lesson}>
                • {l}
              </Text>
            ))}
          </View>
        )} */}
        <Pressable onPress={onContinue} style={styles.primary}>
          {/* <MaterialIcons name="arrow-back" size={22} color="#fff" /> */}
          <Text style={styles.primaryText}>{region ? "Done" : "Done"}</Text>
        </Pressable>
        <Pressable onPress={onReplay} style={styles.secondary}>
          <MaterialIcons name="replay" size={20} color={C.sub} />
          <Text style={styles.secondaryText}>
            {region ? "Run it again" : "New run"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.spacer} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {flyers.map((s) => (
          <Flyer key={s.id} spec={s} />
        ))}
      </View>
    </>
  );
  if (region && region.id === "portland") {
    return (
      <ImageBackground
        ref={rootRef}
        source={PORTLAND_BG}
        style={styles.root}
        resizeMode="cover"
      >
        {body}
      </ImageBackground>
    );
  }
  return (
    <View ref={rootRef} style={[styles.root, { backgroundColor: C.bg }]}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 32,
  },
  hud: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  spacer: { flex: 1 },
  spacerTop: { flex: 2.5 },
  card: {
    backgroundColor: palette.paper,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: palette.bark,
    padding: 20,
    marginHorizontal: 12,
    gap: 5,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: C.sub,
    textAlign: "center",
  },
  stars: { flexDirection: "row", marginVertical: 12, gap: 8 },
  starIcon: { width: 44, height: 44 },
  score: { fontSize: 64, fontWeight: "900", color: C.ink, marginVertical: 8 },
  newBest: {
    fontSize: 15,
    fontWeight: "800",
    color: C.gold,
    letterSpacing: 2,
    marginBottom: 8,
  },
  line: { fontSize: 16, color: C.ink, marginTop: 4, fontWeight: "600" },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginTop: 4,
  },
  statLabel: { fontSize: 16, color: C.ink, fontWeight: "600" },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statIcon: { width: 20, height: 20 },
  statValue: { fontSize: 16, color: C.ink, fontWeight: "800" },
  divider: {
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D8C9AE",
    marginVertical: 6,
    width: "100%",
  },
  lessons: {
    marginTop: 16,
    backgroundColor: "#FAF3E8",
    borderRadius: 12,
    padding: 14,
    width: "100%",
  },
  lessonsTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: C.sub,
    marginBottom: 6,
  },
  lesson: {
    fontSize: 13,
    color: C.ink,
    marginTop: 4,
    lineHeight: 19,
    fontWeight: "600",
  },
  primary: {
    marginTop: 20,
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingHorizontal: 26,
    paddingVertical: 13,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondary: {
    marginTop: 2,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { color: C.sub, fontWeight: "700", fontSize: 14 },
});
