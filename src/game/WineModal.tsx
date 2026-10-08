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
import { SINK_RECT } from "./SinkView";
import { BIN_SPRITES, WINE_CAPSULE } from "./sprites";
import {
  SpriteWine,
  WINE_CAPSULE_H,
  WINE_CAPSULE_W,
  WINE_STAGE_W,
} from "./SpriteWine";

/*
 * Wine-bottle disassembly modal (capsule mechanic). Same chrome as the
 * bottle and coffee-cup modals: prep -> sort -> auto-dismiss.
 *
 * Visual workflow (whole-image swaps, no compositing):
 * - modal open: whole bottle with capsule; capsule is tappable
 * - capsule off: bare bottle + capsule chip on the side
 * - then sort the 2 parts into the in-modal bins
 *   (capsule -> landfill, bottle -> recycle)
 */

type PartId = "capsule" | "bottle";

// invisible tap zone over the capsule on the bottle neck
const CAP_ZONE = {
  x: BX + WINE_STAGE_W * 0.27,
  y: BY,
  w: WINE_STAGE_W * 0.47,
  h: 70,
};

// in-modal sink sits exactly over the main screen's sink (like the
// modal's bins sit over the main bins)
const MODAL_SINK = { ...SINK_RECT };
const MODAL_SINK_IMG = require("../../assets/extra/sink.png");

export function WineModal({
  origin,
  paused,
  ticker,
  danger,
  parts,
  itemId,
  dirty,
  onPartSink,
  onClose,
}: {
  origin: { x: number; y: number };
  paused: boolean;
  ticker: ItemDef[];
  danger: boolean;
  parts: PartDef[];
  itemId?: string;
  dirty: boolean;
  onPartSink: (x: number, y: number) => void;
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
  const [capsuleOff, setCapsuleOff] = useState(false);
  const [capsuleChip, setCapsuleChip] = useState(false);
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

  const capPX = useSharedValue(0);
  const capPY = useSharedValue(0);
  const capPO = useSharedValue(0);
  const capPop = useSharedValue(0);
  const bottleLive = useSharedValue(false);

  const capTx = useSharedValue(0);
  const capTy = useSharedValue(0);
  const bottleTx = useSharedValue(0);
  const bottleTy = useSharedValue(0);

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

  const finishCapsule = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    capPO.value = 0;
    capPop.value = 0;
    setCapsuleOff(true);
    setCapsuleChip(true);
    setHint(null);
    setStep("sort");
    bottleLive.value = true;
  };

  const doCapsuleTap = (ax: number, ay: number) => {
    capPX.value = ax - WINE_CAPSULE_W / 2;
    capPY.value = ay - WINE_CAPSULE_H / 2;
    capPO.value = 1;
    capPop.value = withTiming(
      1,
      { duration: 320, easing: Easing.out(Easing.cubic) },
      (fin) => {
        if (fin) runOnJS(finishCapsule)();
      },
    );
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
    if (sortedIds.length !== 2) return;
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

  const partToSink = (id: PartId, x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const bid = ++burstId.current;
    setBursts((b) => [...b, { id: bid, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((bb) => bb.id !== bid)), 750);
    setHint(null);
    setSortedIds((s) => (s.includes(id) ? s : [...s, id]));
    onPartSink(x, y);
  };

  const bottleNeedsRinse = () => {
    setHint("Rinse it first — drop it in the Sink");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    playWrong();
  };

  const inModalSink = (fx: number, fy: number) => {
    "worklet";
    return (
      fx >= MODAL_SINK.x &&
      fx <= MODAL_SINK.x + MODAL_SINK.w &&
      fy >= MODAL_SINK.y &&
      fy <= MODAL_SINK.y + MODAL_SINK.h
    );
  };

  const capsuleTap = Gesture.Tap().onEnd((e) => {
    runOnJS(doCapsuleTap)(CAP_ZONE.x + e.x, CAP_ZONE.y + e.y);
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
        // dirty bottle: sink is the target, bins bounce back with a hint
        if (id === "bottle" && dirty) {
          if (inModalSink(fx, fy)) {
            runOnJS(partToSink)(id, fx, fy);
          } else if (hit >= 0) {
            runOnJS(bottleNeedsRinse)();
          }
          tx.value = withSpring(0);
          ty.value = withSpring(0);
          return;
        }
        if (hit === PART_BIN[id]) runOnJS(chipSorted)(id, fx, fy);
        else if (hit >= 0) runOnJS(chipWrong)(id);
        else {
          tx.value = withSpring(0);
          ty.value = withSpring(0);
        }
      });

  // Gestures must be stable across re-renders (e.g. when the sink finishes
  // and BeltScreen re-renders) — otherwise an in-progress drag gets cancelled.
  const capsuleGesture = useMemo(
    () => chipPan("capsule", capTx, capTy, null),
    [],
  );
  const bottleGesture = useMemo(
    () => chipPan("bottle", bottleTx, bottleTy, bottleLive),
    [],
  );

  const capPieceStyle = useAnimatedStyle(() => ({
    opacity: capPO.value * (1 - capPop.value),
    transform: [{ translateY: -capPop.value * 130 }],
  }));
  const capStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capTx.value }, { translateY: capTy.value }],
  }));
  const bottleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bottleTx.value }, { translateY: bottleTy.value }],
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
            ? "Pull the capsule off the neck"
            : step === "sort"
              ? dirty
                ? "Capsule in the bin — bottle in the sink"
                : "Sort the parts — drag each to its bin"
              : "Nice work!"}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
        {/* in-modal sink sits below the draggable items in z-order */}
        {dirty && !sortedIds.includes("bottle") && (
          <View
            style={{
              position: "absolute",
              left: MODAL_SINK.x,
              top: MODAL_SINK.y,
              width: MODAL_SINK.w,
              height: MODAL_SINK.h,
            }}
          >
            <Image
              source={MODAL_SINK_IMG}
              style={{ width: MODAL_SINK.w, height: MODAL_SINK.h }}
              resizeMode="contain"
            />
          </View>
        )}
        {/* bottle body (draggable once capsule is off; unmounts when sorted) */}
        {!sortedIds.includes("bottle") && (
          <GestureDetector gesture={bottleGesture}>
            <Animated.View
              style={[
                { position: "absolute", left: BX - 55, top: BY - 50 },
                bottleStyle,
              ]}
            >
              <SpriteWine capsuleOff={capsuleOff} />
            </Animated.View>
          </GestureDetector>
        )}
        {step === "prep" && !capsuleOff && (
          <GestureDetector gesture={capsuleTap}>
            <View
              style={{
                position: "absolute",
                left: CAP_ZONE.x,
                top: CAP_ZONE.y,
                width: CAP_ZONE.w,
                height: CAP_ZONE.h,
              }}
            />
          </GestureDetector>
        )}
        {step === "prep" && !capsuleOff && (
          <View
            style={{ position: "absolute", left: SW / 2 - 38, top: BY + 20 }}
          >
            <Pulse size={76} color={C.gold} />
          </View>
        )}
        <Animated.Image
          source={WINE_CAPSULE}
          style={[
            {
              position: "absolute",
              left: capPX,
              top: capPY,
              width: WINE_CAPSULE_W,
              height: WINE_CAPSULE_H,
            },
            capPieceStyle,
          ]}
          resizeMode="contain"
        />
        {capsuleChip && !sortedIds.includes("capsule") && (
          <GestureDetector gesture={capsuleGesture}>
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: SW - 180,
                  top: BY + 60,
                  width: WINE_CAPSULE_W,
                  height: WINE_CAPSULE_H,
                },
                capStyle,
              ]}
            >
              <Image
                source={WINE_CAPSULE}
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
