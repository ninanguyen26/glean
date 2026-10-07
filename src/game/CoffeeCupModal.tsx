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
import { BinId, BINS, ItemDef, PartDef } from "./items";
import { SpriteCoffeeCup } from "./SpriteCoffeeCup";
import { BIN_SPRITES, COFFEE_CUP_LID, COFFEE_CUP_SLEEVE } from "./sprites";

/*
 * Coffee-cup disassembly modal (lid-sleeve mechanic). Same chrome as the
 * bottle modal: prep -> sort -> auto-dismiss. Part -> bin mapping is
 * data-driven: lid -> recycle, sleeve -> recycle, cup -> landfill.
 *
 * Visual workflow (whole-image swaps, no compositing):
 * - modal open: whole cup; sleeve is draggable, lid is tappable
 * - lid off: bare body + lid chip on the side
 * - sleeve off: bare body + sleeve chip on the side
 * - both off: sort the 3 parts into the in-modal bins
 */

type PartId = "lid" | "sleeve" | "cup";

// stage origin in full-screen modal coords (stage is 320x320)
const SX = BX - 50;
const SY = BY - 10;

// invisible interaction zones over the whole-cup art
const LID_ZONE = { x: SX + 69, y: SY + 9, w: 137, h: 81 };
const SLV_ZONE = { x: SX + 69, y: SY + 107, w: 137, h: 94 };

const LID_PIECE_W = 150;
const LID_PIECE_H = 105;
const SLV_PIECE_W = 175;
const SLV_PIECE_H = 70;

export function CoffeeCupModal({
  origin,
  paused,
  ticker,
  danger,
  parts,
  itemId,
  onClose,
}: {
  origin: { x: number; y: number };
  paused: boolean;
  ticker: ItemDef[];
  danger: boolean;
  parts: PartDef[];
  itemId?: string;
  onClose: (allCorrect: boolean) => void;
}) {
  const binIndex = (b: BinId) => BINS.findIndex((x) => x.id === b);
  const PART_BIN: Record<PartId, number> = Object.fromEntries(
    parts.map((p) => [p.id, binIndex(p.bin)]),
  ) as Record<PartId, number>;
  const PART_HINT: Record<PartId, string> = Object.fromEntries(
    parts.map((p) => [p.id, p.hint]),
  ) as Record<PartId, string>;
  const [step, setStep] = useState<"prep" | "sort" | "done">("prep");
  const [lidOff, setLidOff] = useState(false);
  const [sleeveOff, setSleeveOff] = useState(false);
  const [lidChip, setLidChip] = useState(false);
  const [sleeveChip, setSleeveChip] = useState(false);
  const [sortedIds, setSortedIds] = useState<PartId[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>(
    [],
  );
  const burstId = useRef(0);
  const wrongRef = useRef(0);

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

  const lidPX = useSharedValue(0);
  const lidPY = useSharedValue(0);
  const lidPO = useSharedValue(0);
  const lidPop = useSharedValue(0);
  const slvPX = useSharedValue(0);
  const slvPY = useSharedValue(0);
  const slvPO = useSharedValue(0);
  const grabAX = useSharedValue(0);
  const grabAY = useSharedValue(0);
  const sleeveLive = useSharedValue(true);
  const cupLive = useSharedValue(false);

  const lidTx = useSharedValue(0);
  const lidTy = useSharedValue(0);
  const sleeveTx = useSharedValue(0);
  const sleeveTy = useSharedValue(0);
  const cupTx = useSharedValue(0);
  const cupTy = useSharedValue(0);
  const TX: Record<PartId, { tx: any; ty: any }> = {
    lid: { tx: lidTx, ty: lidTy },
    sleeve: { tx: sleeveTx, ty: sleeveTy },
    cup: { tx: cupTx, ty: cupTy },
  };

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

  const finishLid = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    lidPO.value = 0;
    lidPop.value = 0;
    setLidOff(true);
    setLidChip(true);
    setHint(null);
    if (sleeveOff) {
      setStep("sort");
      cupLive.value = true;
    }
  };

  const doLidTap = (ax: number, ay: number) => {
    lidPX.value = ax - LID_PIECE_W / 2;
    lidPY.value = ay - LID_PIECE_H / 2;
    lidPO.value = 1;
    lidPop.value = withTiming(
      1,
      { duration: 320, easing: Easing.out(Easing.cubic) },
      (fin) => {
        if (fin) runOnJS(finishLid)();
      },
    );
  };

  const doSleeveGrab = (ax: number, ay: number) => {
    grabAX.value = ax;
    grabAY.value = ay;
    slvPX.value = ax - SLV_PIECE_W / 2;
    slvPY.value = ay - SLV_PIECE_H / 2;
    // opacity stays 0 until the finger actually moves (onUpdate) -
    // a tap shouldn't flash a duplicate sleeve on top of the cup
  };

  const cancelSleeve = () => {
    slvPO.value = withTiming(0, { duration: 150 });
  };

  const finishSleeve = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    slvPO.value = 0;
    setSleeveOff(true);
    setSleeveChip(true);
    setHint(null);
    if (lidOff) {
      setStep("sort");
      cupLive.value = true;
    }
  };

  const chipSorted = (id: PartId, x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playCorrect();
    const bid = ++burstId.current;
    setBursts((b) => [...b, { id: bid, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((bb) => bb.id !== bid)), 750);
    setHint(null);
    setSortedIds((s) => (s.includes(id) ? s : [...s, id]));
  };

  useEffect(() => {
    if (sortedIds.length !== 3) return;
    const t1 = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
      const t2 = setTimeout(() => onClose(wrongRef.current === 0), 650);
    }, 450);
    return () => clearTimeout(t1);
  }, [sortedIds]);

  const chipWrong = (id: PartId) => {
    wrongRef.current += 1;
    setHint(PART_HINT[id]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    playWrong();
    setSortedIds((s) => (s.includes(id) ? s : [...s, id]));
  };

  const lidTap = Gesture.Tap().onEnd((e) => {
    runOnJS(doLidTap)(LID_ZONE.x + e.x, LID_ZONE.y + e.y);
  });

  const sleeveDrag = Gesture.Pan()
    .onBegin((e) => {
      runOnJS(doSleeveGrab)(SLV_ZONE.x + e.x, SLV_ZONE.y + e.y);
    })
    .onUpdate((e) => {
      if (!sleeveLive.value) return;
      if (slvPO.value === 0) slvPO.value = withTiming(1, { duration: 120 });
      slvPX.value = grabAX.value + e.translationX - SLV_PIECE_W / 2;
      slvPY.value = grabAY.value + e.translationY - SLV_PIECE_H / 2;
    })
    .onEnd((e) => {
      if (!sleeveLive.value) return;
      if (e.translationY > 90) {
        sleeveLive.value = false;
        runOnJS(finishSleeve)();
      } else {
        runOnJS(cancelSleeve)();
      }
    });

  const chipPan = (id: PartId, tx: any, ty: any, live: any) =>
    Gesture.Pan()
      .minDistance(12)
      .onUpdate((e) => {
        if (live && !live.value) return;
        tx.value = e.translationX;
        ty.value = e.translationY;
      })
      .onEnd((e) => {
        if (live && !live.value) return;
        const fx = e.absoluteX;
        const fy = e.absoluteY;
        const hit = hitBinPoint(binRects, fx, fy);
        if (hit === PART_BIN[id]) runOnJS(chipSorted)(id, fx, fy);
        else if (hit >= 0) runOnJS(chipWrong)(id);
        else {
          tx.value = withSpring(0);
          ty.value = withSpring(0);
        }
      });

  // Gestures must be stable across re-renders (e.g. when the sink finishes
  // and BeltScreen re-renders) — otherwise an in-progress drag gets cancelled.
  const lidGesture = useMemo(() => chipPan("lid", lidTx, lidTy, null), []);
  const sleeveGesture = useMemo(() => chipPan("sleeve", sleeveTx, sleeveTy, null), []);
  const cupGesture = useMemo(() => chipPan("cup", cupTx, cupTy, cupLive), []);

  const lidPieceStyle = useAnimatedStyle(() => ({
    opacity: lidPO.value * (1 - lidPop.value),
    transform: [{ translateY: -lidPop.value * 130 }],
  }));
  const slvPieceStyle = useAnimatedStyle(() => ({ opacity: slvPO.value }));
  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lidTx.value }, { translateY: lidTy.value }],
  }));
  const sleeveStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sleeveTx.value }, { translateY: sleeveTy.value }],
  }));
  const cupStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cupTx.value }, { translateY: cupTy.value }],
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
            ? "Pop the lid and slide the sleeve off — either order"
            : step === "sort"
              ? "Sort the parts — drag each to its bin"
              : "Nice work!"}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
        {!sortedIds.includes("cup") && (
          <GestureDetector gesture={cupGesture}>
            <Animated.View
              style={[{ position: "absolute", left: SX, top: SY }, cupStyle]}
            >
              <SpriteCoffeeCup lidOff={lidOff} sleeveOff={sleeveOff} />
            </Animated.View>
          </GestureDetector>
        )}
        {step === "prep" && !lidOff && (
          <GestureDetector gesture={lidTap}>
            <View
              style={{
                position: "absolute",
                left: LID_ZONE.x,
                top: LID_ZONE.y,
                width: LID_ZONE.w,
                height: LID_ZONE.h,
              }}
            />
          </GestureDetector>
        )}
        {step === "prep" && !lidOff && (
          <View
            style={{ position: "absolute", left: SW / 2 - 38, top: SY + 15 }}
          >
            <Pulse size={76} color={C.gold} />
          </View>
        )}
        {step === "prep" && !sleeveOff && (
          <GestureDetector gesture={sleeveDrag}>
            <View
              style={{
                position: "absolute",
                left: SLV_ZONE.x,
                top: SLV_ZONE.y,
                width: SLV_ZONE.w,
                height: SLV_ZONE.h,
              }}
            />
          </GestureDetector>
        )}
        {step === "prep" && !sleeveOff && (
          <View
            style={{ position: "absolute", left: SW / 2 - 38, top: SY + 120 }}
          >
            <Pulse size={76} color={C.gold} />
          </View>
        )}
        <Animated.Image
          source={COFFEE_CUP_LID}
          style={[
            {
              position: "absolute",
              left: lidPX,
              top: lidPY,
              width: LID_PIECE_W,
              height: LID_PIECE_H,
            },
            lidPieceStyle,
          ]}
          resizeMode="contain"
        />
        <Animated.Image
          source={COFFEE_CUP_SLEEVE}
          style={[
            {
              position: "absolute",
              left: slvPX,
              top: slvPY,
              width: SLV_PIECE_W,
              height: SLV_PIECE_H,
            },
            slvPieceStyle,
          ]}
          resizeMode="contain"
        />
        {lidChip && !sortedIds.includes("lid") && (
          <GestureDetector gesture={lidGesture}>
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: SW - 160,
                  top: BY + 80,
                  width: LID_PIECE_W,
                  height: LID_PIECE_H,
                },
                lidStyle,
              ]}
            >
              <Image
                source={COFFEE_CUP_LID}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </Animated.View>
          </GestureDetector>
        )}
        {sleeveChip && !sortedIds.includes("sleeve") && (
          <GestureDetector
            gesture={sleeveGesture}
          >
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: 20,
                  top: BY + 100,
                  width: SLV_PIECE_W,
                  height: SLV_PIECE_H,
                },
                sleeveStyle,
              ]}
            >
              <Image
                source={COFFEE_CUP_SLEEVE}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </Animated.View>
          </GestureDetector>
        )}
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
