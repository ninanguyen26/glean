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
import { BIN_SPRITES, DETERGENT_BODY, DETERGENT_CAP } from "./sprites";
import {
  DETERGENT_CAP_H,
  DETERGENT_CAP_W,
  DETERGENT_STAGE_H,
  DETERGENT_STAGE_W,
  SpriteDetergent,
} from "./SpriteDetergent";

/*
 * Detergent-bottle disassembly modal (twist mechanic + rinse = BOTH item).
 * Twist gesture from DisassemblyModal, in-modal sink from WineModal.
 *
 * Visual workflow (whole-image swaps, no compositing):
 * - modal open: whole bottle with cap; cap is twistable
 * - cap off: bare bottle + cap chip on the side
 * - then sort the 2 parts (cap -> recycle, body -> recycle or sink if dirty)
 */

type PartId = "cap" | "body";

const TWIST_TARGET = Math.PI * 0.95;

// twist zone over the cap (tune: cap is top-center of the stage)
const TWIST_ZONE = {
  x: BX - 55 + DETERGENT_STAGE_W / 2 - 85,
  y: BY - 50,
  w: 170,
  h: 120,
};
// cap center within the 170x120 twist zone
const CAP_CX = 85;
const CAP_CY = 47;

// in-modal sink sits exactly over the main screen's sink (like the
// modal's bins sit over the main bins)
const MODAL_SINK = { ...SINK_RECT };
const MODAL_SINK_IMG = require("../../assets/extra/sink.png");

export function DetergentModal({
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
  onPartSink: (x: number, y: number, spriteOverride?: any) => void;
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
  const [capOff, setCapOff] = useState(false);
  const [capChip, setCapChip] = useState(false);
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

  // twist state
  const twistProg = useSharedValue(0);
  const capWig = useSharedValue(0);
  const accRot = useSharedValue(0);
  const lastAng = useSharedValue(0);
  const hasAng = useSharedValue(false);
  const lastTick = useSharedValue(0);
  const twistLive = useSharedValue(true);
  const bodyLive = useSharedValue(false);
  const twistBar = useAnimatedStyle(() => ({ width: twistProg.value * 220 }));

  // chip drag positions
  const capTx = useSharedValue(0);
  const capTy = useSharedValue(0);
  const bodyTx = useSharedValue(0);
  const bodyTy = useSharedValue(0);

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

  // named fn on the JS side: worklets can't schedule inline closures
  const tickHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const popCap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCapOff(true);
    setCapChip(true);
    setHint(null);
    setStep("sort");
    bodyLive.value = true;
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
    onPartSink(x, y, DETERGENT_BODY);
  };

  const bodyNeedsRinse = () => {
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

  // one-finger circular twist around the cap
  const twistGesture = Gesture.Pan()
    .onBegin(() => {
      hasAng.value = false;
    })
    .onUpdate((e) => {
      if (!twistLive.value) return;
      const dx = e.x - CAP_CX;
      const dy = e.y - CAP_CY;
      if (dx * dx + dy * dy < 22 * 22) return;
      const ang = Math.atan2(dy, dx);
      if (hasAng.value) {
        let d = ang - lastAng.value;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        accRot.value = accRot.value + Math.abs(d);
        twistProg.value = Math.min(1, accRot.value / TWIST_TARGET);
        capWig.value = Math.sin(accRot.value * 9) * 4;
        const tick = Math.floor(accRot.value / (Math.PI / 2));
        if (tick > lastTick.value) {
          lastTick.value = tick;
          runOnJS(tickHaptic)();
        }
        if (accRot.value >= TWIST_TARGET) {
          twistLive.value = false;
          capWig.value = 0;
          runOnJS(popCap)();
        }
      }
      lastAng.value = ang;
      hasAng.value = true;
    })
    .onEnd(() => {
      hasAng.value = false;
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
        // dirty body: sink is the target, bins bounce back with a hint
        if (id === "body" && dirty) {
          if (inModalSink(fx, fy)) {
            runOnJS(partToSink)(id, fx, fy);
          } else if (hit >= 0) {
            runOnJS(bodyNeedsRinse)();
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

  // Gestures must be stable across re-renders — otherwise an in-progress
  // drag gets cancelled.
  const capGesture = useMemo(() => chipPan("cap", capTx, capTy, null), []);
  const bodyGesture = useMemo(
    () => chipPan("body", bodyTx, bodyTy, bodyLive),
    [],
  );
  const twistStable = useMemo(() => twistGesture, []);

  const capWigStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capWig.value }],
  }));
  const capStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capTx.value }, { translateY: capTy.value }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bodyTx.value }, { translateY: bodyTy.value }],
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
            ? "Twist the cap off"
            : step === "sort"
              ? dirty
                ? "Cap in the bin — bottle in the sink"
                : "Sort the parts — drag each to its bin"
              : "Nice work!"}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
        {step === "prep" && !capOff && (
          <View style={styles.progWrap}>
            <Animated.View style={[styles.progFill, twistBar]} />
          </View>
        )}
        {/* in-modal sink sits below the draggable items in z-order */}
        {dirty && !sortedIds.includes("body") && (
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
        {/* bottle body (draggable once cap is off; unmounts when sorted) */}
        {!sortedIds.includes("body") && (
          <GestureDetector gesture={bodyGesture}>
            <Animated.View
              style={[
                { position: "absolute", left: BX - 55, top: BY - 50 },
                bodyStyle,
              ]}
            >
              <SpriteDetergent capOff={capOff} />
            </Animated.View>
          </GestureDetector>
        )}
        {/* twist zone over the cap */}
        {step === "prep" && !capOff && (
          <GestureDetector gesture={twistStable}>
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: TWIST_ZONE.x,
                  top: TWIST_ZONE.y,
                  width: TWIST_ZONE.w,
                  height: TWIST_ZONE.h,
                },
                capWigStyle,
              ]}
            />
          </GestureDetector>
        )}
        {step === "prep" && !capOff && (
          <View
            style={{ position: "absolute", left: SW / 2 - 38, top: BY + 20 }}
          >
            <Pulse size={76} color={C.gold} />
          </View>
        )}
        {capChip && !sortedIds.includes("cap") && (
          <GestureDetector gesture={capGesture}>
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: SW - 180,
                  top: BY + 60,
                  width: DETERGENT_CAP_W,
                  height: DETERGENT_CAP_H,
                },
                capStyle,
              ]}
            >
              <Image
                source={DETERGENT_CAP}
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
  progWrap: {
    alignSelf: "center",
    marginTop: 10,
    width: 220,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: C.gold,
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
