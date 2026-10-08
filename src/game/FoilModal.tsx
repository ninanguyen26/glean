import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { playCorrect, playWrong } from "../audio/sounds";
import {
  BIN_BOTTOM,
  BIN_GAP,
  BIN_H,
  BIN_W,
  binX,
  binY,
  Burst,
  BX,
  BY,
  C,
  Pulse,
  SH,
  SW,
} from "../spike/effects";
import { hitBinPoint } from "./binHit";
import { BINS, GameItem, ItemDef } from "./items";
import { BIN_SPRITES, FOIL_BALL, ITEM_SPRITES } from "./sprites";

/*
 * Foil crumple modal (crumple mechanic). Same chrome as the other prep
 * modals: prep -> sort -> auto-dismiss.
 *
 * - prep: tap the sheet 3 times; each tap dents it toward the tap point
 *   (scale x0.85 anchored at the tap, alternating rotation, light tick)
 * - 3rd tap: the sheet swaps to the balled sprite with a spring pop
 * - sort: drag the ball to its bin (recycle)
 */

const TAPS_NEEDED = 3;
const SHEET = 230;
const BALL = 150;

export function FoilModal({
  origin,
  paused,
  ticker,
  danger,
  item,
  onClose,
}: {
  origin: { x: number; y: number };
  paused: boolean;
  ticker: ItemDef[];
  danger: boolean;
  item: GameItem;
  onClose: (allCorrect: boolean) => void;
}) {
  const BALL_BIN = BINS.findIndex((b) => b.id === item.bin);
  const [step, setStep] = useState<"prep" | "sort" | "done">("prep");
  const [taps, setTaps] = useState(0);
  const [balled, setBalled] = useState(false);
  const [sorted, setSorted] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>(
    [],
  );
  const burstId = useRef(0);
  const wrongRef = useRef(0);
  const tapsRef = useRef(0);

  // modal zoom from the drop point (calm ease-out, no bounce)
  const mScale = useSharedValue(0.25);
  const mOp = useSharedValue(0);
  const mTx = useSharedValue(origin.x - SW / 2);
  const mTy = useSharedValue(origin.y - SH / 2);
  const mStyle = useAnimatedStyle(() => ({
    opacity: mOp.value,
    transform: [
      { translateX: mTx.value },
      { translateY: mTy.value },
      { scale: mScale.value },
    ],
  }));
  useEffect(() => {
    const e = Easing.out(Easing.cubic);
    mTx.value = withTiming(0, { duration: 380, easing: e });
    mTy.value = withTiming(0, { duration: 380, easing: e });
    mScale.value = withTiming(1, { duration: 380, easing: e });
    mOp.value = withTiming(1, { duration: 180 });
  }, []);

  // crumple progress (drives the dent transform) + tap point offsets
  const stageV = useSharedValue(0);
  const tapPX = useSharedValue(0);
  const tapPY = useSharedValue(0);
  const ballPop = useSharedValue(0.55);
  const ballTx = useSharedValue(0);
  const ballTy = useSharedValue(0);
  const ballLive = useSharedValue(false);

  const binRects = useSharedValue<
    { x: number; y: number; w: number; h: number }[]
  >([]);
  useEffect(() => {
    binRects.value = [0, 1, 2].map((i) => ({
      x: binX(i),
      y: binY,
      w: BIN_W,
      h: BIN_H,
    }));
  }, []);

  const doTap = (ox: number, oy: number) => {
    if (tapsRef.current >= TAPS_NEEDED) return;
    const n = tapsRef.current + 1;
    tapsRef.current = n;
    stageV.value = n;
    tapPX.value = ox;
    tapPY.value = oy;
    setTaps(n);
    if (n >= TAPS_NEEDED) {
      // balled: swap to the ball sprite with a spring pop
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      ballPop.value = withSpring(1, { damping: 11 });
      const bid = ++burstId.current;
      setBursts((b) => [...b, { id: bid, x: BX, y: BY }]);
      setTimeout(() => setBursts((b) => b.filter((bb) => bb.id !== bid)), 750);
      setBalled(true);
      setHint(null);
      setStep("sort");
      ballLive.value = true;
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const ballSorted = (x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playCorrect();
    const bid = ++burstId.current;
    setBursts((b) => [...b, { id: bid, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((bb) => bb.id !== bid)), 750);
    setHint(null);
    setSorted(true);
  };

  useEffect(() => {
    if (!sorted) return;
    const t1 = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
      const t2 = setTimeout(() => onClose(wrongRef.current === 0), 650);
    }, 450);
    return () => clearTimeout(t1);
  }, [sorted]);

  // the ball is already prepped — a wrong bin needs a sort hint,
  // not the prep teaching line
  const ballWrong = () => {
    wrongRef.current += 1;
    setHint("Balled foil goes in recycling.");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    playWrong();
    setSorted(true);
  };

  const sheetTap = Gesture.Tap().onEnd((e) => {
    runOnJS(doTap)(e.x - SHEET / 2, e.y - SHEET / 2);
  });

  const ballPan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(12)
        .onUpdate((e) => {
          if (!ballLive.value) return;
          ballTx.value = e.translationX;
          ballTy.value = e.translationY;
        })
        .onEnd((e) => {
          if (!ballLive.value) return;
          const fx = e.absoluteX;
          const fy = e.absoluteY;
          const hit = hitBinPoint(binRects, fx, fy);
          if (hit === BALL_BIN) runOnJS(ballSorted)(fx, fy);
          else if (hit >= 0) runOnJS(ballWrong)();
          else {
            ballTx.value = withSpring(0);
            ballTy.value = withSpring(0);
          }
        }),
    [],
  );

  // dent toward the tap point: scale x0.85 per tap, alternating rotation
  const sheetStyle = useAnimatedStyle(() => {
    const s = Math.pow(0.85, stageV.value);
    const r = (stageV.value % 2 === 1 ? -1 : 1) * stageV.value * 7;
    return {
      transform: [
        { translateX: tapPX.value },
        { translateY: tapPY.value },
        { scale: s },
        { rotate: `${r}deg` },
        { translateX: -tapPX.value },
        { translateY: -tapPY.value },
      ],
    };
  });
  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballTx.value },
      { translateY: ballTy.value },
      { scale: ballPop.value },
    ],
  }));

  return (
    <View style={styles.modalWrap} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: mOp }]} />
      <Animated.View style={[styles.modalContent, mStyle]}>
        <Text style={styles.stepKicker}>
          {step === "done"
            ? "done"
            : step === "prep"
              ? "step 1 of 2 · prep"
              : "step 2 of 2 · sort"}
        </Text>
        {!paused && (
          <View style={styles.ticker}>
            {danger && <View style={styles.tickerDanger} />}
            <Text style={styles.tickerLabel}>ON THE BELT</Text>
            <View style={styles.tickerRow}>
              {(ticker ?? []).map((t, i) =>
                t ? (
                  <View key={`${t.id}-${i}`} style={styles.tickerItem}>
                    <View
                      style={[
                        styles.tickerDot,
                        {
                          backgroundColor: t.color,
                          borderRadius: t.shape === "circle" ? 12 : 6,
                        },
                        t.shape === "diamond" && styles.tickerDiamond,
                      ]}
                    />
                    <Text style={styles.tickerName} numberOfLines={1}>
                      {t.name}
                    </Text>
                  </View>
                ) : null,
              )}
            </View>
          </View>
        )}
        {paused && (
          <View style={styles.pausedPill}>
            <Text style={styles.pausedText}>Belt paused — take your time</Text>
          </View>
        )}
        <Text style={styles.instruction}>
          {step === "prep"
            ? "Tap 3 times to ball it up"
            : step === "sort"
              ? "Drag the ball to its bin"
              : "Nice work!"}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}

        {/* tap progress dots */}
        {step === "prep" && (
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[styles.dot, i < taps && styles.dotFilled]}
              />
            ))}
          </View>
        )}

        {/* foil sheet (tappable while prepping; unmounts when balled) */}
        {step === "prep" && !balled && (
          <GestureDetector gesture={sheetTap}>
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: BX - SHEET / 2 + 80,
                  top: BY - SHEET / 2 + 80,
                  width: SHEET,
                  height: SHEET,
                },
                sheetStyle,
              ]}
            >
              <Image
                source={ITEM_SPRITES[item.id]}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </Animated.View>
          </GestureDetector>
        )}
        {step === "prep" && !balled && (
          <View style={{ position: "absolute", left: BX + 45, top: BY + 45 }}>
            <Pulse size={76} color={C.gold} />
          </View>
        )}

        {/* balled foil (draggable once balled; unmounts when sorted) */}
        {balled && !sorted && (
          <GestureDetector gesture={ballPan}>
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: BX - BALL / 2 + 75,
                  top: BY - BALL / 2 + 80,
                  width: BALL,
                  height: BALL,
                },
                ballStyle,
              ]}
            >
              <Image
                source={FOIL_BALL}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </Animated.View>
          </GestureDetector>
        )}

        {/* in-modal bins (same 3 streams as the main screen) */}
        <View style={styles.bins}>
          {BINS.map((b) => (
            <View key={b.id} style={styles.bin}>
              <Image
                source={BIN_SPRITES[b.id]}
                style={{ width: BIN_W, height: BIN_H }}
                resizeMode="contain"
              />
            </View>
          ))}
        </View>

        {bursts.map((bb) => (
          <Burst key={bb.id} x={bb.x} y={bb.y} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 15, 11, 0.55)",
  },
  modalContent: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  stepKicker: {
    textAlign: "center",
    marginTop: 155,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#fff",
    opacity: 0.95,
  },
  ticker: {
    marginTop: 10,
    marginHorizontal: 40,
    backgroundColor: "rgba(83, 7, 7, 0.12)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  tickerDanger: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: "#E05A4B",
  },
  tickerLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.7)",
  },
  tickerRow: { flexDirection: "row", marginTop: 6, gap: 14 },
  tickerItem: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  tickerDot: { width: 24, height: 24 },
  tickerDiamond: { transform: [{ rotate: "45deg" }] },
  tickerName: { fontSize: 11, fontWeight: "600", color: "#fff", flexShrink: 1 },
  pausedPill: {
    alignSelf: "center",
    marginTop: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  pausedText: { fontSize: 13, fontWeight: "700", color: C.ink },
  instruction: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    paddingHorizontal: 40,
  },
  hint: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#FFD9A8",
    paddingHorizontal: 40,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  dotFilled: { backgroundColor: C.gold },
  bins: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: BIN_BOTTOM,
    flexDirection: "row",
    justifyContent: "center",
    gap: BIN_GAP,
  },
  bin: {
    width: BIN_W,
    height: BIN_H,
    justifyContent: "center",
    alignItems: "center",
  },
});
