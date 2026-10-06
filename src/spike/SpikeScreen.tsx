import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  C, SW, SH, BX, BY, BW, BH,
  BIN_W, BIN_H, BIN_GAP, BIN_BOTTOM, binX, binY,
  Pulse, Burst,
} from './effects';
import { BeltBottle, ModalBottle } from './BottleArt';

const TWIST_TARGET = Math.PI * 1.25; // ~225 degrees of cumulative twist
const PEEL_DIST = 150; // drag px for a full peel

type ChipId = 'cap' | 'wrapper' | 'body';

const BINS = [
  { id: 0, label: 'PET', color: C.pet },
  { id: 1, label: 'Plastic', color: C.plastic },
  { id: 2, label: 'Other', color: C.other },
];
const CORRECT_BIN: Record<ChipId, number> = { cap: 1, wrapper: 1, body: 0 };
const HINTS: Record<ChipId, string> = {
  cap: 'Caps go with plastic.',
  wrapper: 'Labels go with plastic.',
  body: 'Bottles go in PET.',
};

// chip home frames (modal-content coords)
const CAP = { x: BX + 43, y: BY - 53, w: 64, h: 40 };
const WRAP = { x: BX + 10, y: BY + 94, w: 130, h: 84 };
const BODY = { x: BX, y: BY, w: BW, h: BH };

const INSTRUCTIONS: Record<string, string> = {
  prep: 'Twist the cap and peel the wrapper — either order',
  sort: 'Sort the parts — drag each to its bin',
  done: 'Nice work!',
};

export function SpikeScreen() {
  const [phase, setPhase] = useState<'belt' | 'modal' | 'done'>('belt');
  const [step, setStep] = useState<'prep' | 'sort' | 'done'>('prep');
  const [capGone, setCapGone] = useState(false);
  const [wrapGone, setWrapGone] = useState(false);
  const [capChip, setCapChip] = useState(false);
  const [wrapChip, setWrapChip] = useState(false);
  const [sortedIds, setSortedIds] = useState<ChipId[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [tapPt, setTapPt] = useState({ x: SW / 2, y: SH / 2 });
  const burstId = React.useRef(0);

  // modal open/close animation
  const mScale = useSharedValue(0.25);
  const mOp = useSharedValue(0);
  const mTx = useSharedValue(0);
  const mTy = useSharedValue(0);
  const mStyle = useAnimatedStyle(() => ({
    opacity: mOp.value,
    transform: [{ translateX: mTx.value }, { translateY: mTy.value }, { scale: mScale.value }],
  }));

  // twist + peel progress
  const twistProg = useSharedValue(0);
  const peelProg = useSharedValue(0);
  const capWig = useSharedValue(0);
  const accRot = useSharedValue(0);
  const lastRot = useSharedValue(0);
  const peelStart = useSharedValue(0);
  const twistLive = useSharedValue(true);
  const peelLive = useSharedValue(false);
  const bodyLive = useSharedValue(false);

  // Skia-driven peel/cap (shared values as top-level props = v2-safe)
  const wrapH = useDerivedValue(() => 92 * (1 - peelProg.value));
  const flapH = useDerivedValue(() => 92 * peelProg.value);
  const flapY = useDerivedValue(() => 150 + 92 * (1 - peelProg.value));
  const capX = useDerivedValue(() => 65 + capWig.value);
  const capY = useDerivedValue(() => 8 - twistProg.value * 14); // cap rises as you unscrew
  const twistBar = useAnimatedStyle(() => ({ width: twistProg.value * 220 }));

  // chip drag positions
  const capTx = useSharedValue(0);
  const capTy = useSharedValue(0);
  const wrapTx = useSharedValue(0);
  const wrapTy = useSharedValue(0);
  const bodyTx = useSharedValue(0);
  const bodyTy = useSharedValue(0);
  const TX: Record<ChipId, { tx: any; ty: any }> = {
    cap: { tx: capTx, ty: capTy },
    wrapper: { tx: wrapTx, ty: wrapTy },
    body: { tx: bodyTx, ty: bodyTy },
  };

  // bin frames for hit-testing (same coord space as chips)
  const binRects = useSharedValue<{ x: number; y: number; w: number; h: number }[]>([]);
  useEffect(() => {
    binRects.value = [0, 1, 2].map((i) => ({ x: binX(i), y: binY, w: BIN_W, h: BIN_H }));
  }, []);

  const openModal = (px: number, py: number) => {
    setTapPt({ x: px, y: py });
    mScale.value = 0.25;
    mTx.value = px - SW / 2;
    mTy.value = py - SH / 2;
    mOp.value = 0;
    setPhase('modal');
    setStep('prep');
    twistLive.value = true;
    peelLive.value = true;
    // calm ease-out zoom — no bounce (spring overshoot felt "in the face")
    const zoomEase = Easing.out(Easing.cubic);
    mTx.value = withTiming(0, { duration: 380, easing: zoomEase });
    mTy.value = withTiming(0, { duration: 380, easing: zoomEase });
    mScale.value = withTiming(1, { duration: 380, easing: zoomEase });
    mOp.value = withTiming(1, { duration: 180 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const closeModal = () => {
    mTx.value = withTiming(tapPt.x - SW / 2, { duration: 220 });
    mTy.value = withTiming(tapPt.y - SH / 2, { duration: 220 });
    mScale.value = withTiming(0.25, { duration: 220 });
    mOp.value = withTiming(0, { duration: 200 });
    setTimeout(() => setPhase('done'), 240);
  };

  // Ratchet tick while twisting — must be a named fn on the JS side:
  // worklets can't schedule inline closures back to the RN runtime.
  const tickHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const popCap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCapGone(true);
    setCapChip(true);
    setHint(null);
    if (wrapGone) {
      setStep('sort');
      bodyLive.value = true;
    }
  };

  const finishPeel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWrapGone(true);
    setWrapChip(true);
    setHint(null);
    if (capGone) {
      setStep('sort');
      bodyLive.value = true;
    }
  };

  const chipSorted = (id: ChipId, x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const bid = ++burstId.current;
    setBursts((b) => [...b, { id: bid, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((bb) => bb.id !== bid)), 750);
    setHint(null);
    setSortedIds((s) => {
      const n = [...s, id];
      if (n.length === 3) {
        setTimeout(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setStep('done');
          setTimeout(closeModal, 1100);
        }, 650);
      }
      return n;
    });
  };

  const chipWrong = (id: ChipId) => {
    setHint(HINTS[id]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const t = TX[id];
    t.tx.value = withSequence(
      withTiming(-12, { duration: 55 }),
      withTiming(12, { duration: 55 }),
      withSpring(0),
    );
    t.ty.value = withSpring(0);
  };

  const reset = () => {
    twistProg.value = 0;
    peelProg.value = 0;
    capWig.value = 0;
    accRot.value = 0;
    twistLive.value = true;
    peelLive.value = true;
    bodyLive.value = false;
    lastTick.value = 0;
    hasAng.value = false;
    capTx.value = 0; capTy.value = 0;
    wrapTx.value = 0; wrapTy.value = 0;
    bodyTx.value = 0; bodyTy.value = 0;
    setCapGone(false); setWrapGone(false);
    setCapChip(false); setWrapChip(false);
    setSortedIds([]); setHint(null); setBursts([]);
    setStep('prep');
    setPhase('belt');
  };

  // ---- gestures ----
  const inBin = (cx: number, cy: number) => {
    'worklet';
    const rs = binRects.value;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) return i;
    }
    return -1;
  };

  // One-finger twist: circle the cap, like turning a knob. The angle of
  // the touch around the cap center accumulates — either direction counts.
  // Twist zone is 170x120 at (BX-10, BY-80); cap center in zone coords:
  const TWIST_CX = 85;
  const TWIST_CY = 47;
  const lastAng = useSharedValue(0);
  const hasAng = useSharedValue(false);
  const lastTick = useSharedValue(0);
  const twistGesture = Gesture.Pan()
    .onBegin(() => {
      hasAng.value = false;
    })
    .onUpdate((e) => {
      if (!twistLive.value) return;
      const dx = e.x - TWIST_CX;
      const dy = e.y - TWIST_CY;
      if (dx * dx + dy * dy < 22 * 22) return; // too close to center: angle unstable
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

  const peelGesture = Gesture.Pan()
    .onBegin(() => {
      peelStart.value = peelProg.value;
    })
    .onUpdate((e) => {
      if (!peelLive.value) return;
      peelProg.value = Math.max(0, Math.min(1, peelStart.value + e.translationY / PEEL_DIST));
    })
    .onEnd(() => {
      if (!peelLive.value) return;
      if (peelProg.value > 0.8) {
        peelLive.value = false;
        peelProg.value = 1;
        runOnJS(finishPeel)();
      } else {
        peelProg.value = withSpring(0);
      }
    });

  const chipPan = (
    id: ChipId,
    tx: any,
    ty: any,
    homeX: number,
    homeY: number,
    w: number,
    h: number,
    live: any,
  ) =>
    Gesture.Pan()
      .onUpdate((e) => {
        if (live && !live.value) return;
        tx.value = e.translationX;
        ty.value = e.translationY;
      })
      .onEnd((e) => {
        if (live && !live.value) return;
        const cx = homeX + w / 2 + e.translationX;
        const cy = homeY + h / 2 + e.translationY;
        const hit = inBin(cx, cy);
        if (hit === CORRECT_BIN[id]) runOnJS(chipSorted)(id, cx, cy);
        else runOnJS(chipWrong)(id);
      });

  const capStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capTx.value }, { translateY: capTy.value }],
  }));
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: wrapTx.value }, { translateY: wrapTy.value }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bodyTx.value }, { translateY: bodyTy.value }],
  }));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>GLEAN</Text>
        <Text style={styles.sub}>feel spike · one bottle</Text>
      </View>

      <View style={styles.beltWrap}>
        <View style={styles.belt}>
          {phase === 'belt' && (
            <Pressable
              onPress={(e) => openModal(e.nativeEvent.pageX, e.nativeEvent.pageY)}
              style={styles.beltBottle}
            >
              <BeltBottle />
            </Pressable>
          )}
        </View>
        {phase === 'belt' && (
          <View style={styles.tapHint}>
            <Pulse size={76} color={C.gold} />
            <Text style={styles.tapText}>tap the bottle</Text>
          </View>
        )}
        {phase === 'done' && (
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>Spike complete</Text>
            <Text style={styles.doneSub}>How did the twist + peel feel?</Text>
            <Pressable onPress={reset} style={styles.replay}>
              <Text style={styles.replayText}>Run it again</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>testing: twist · peel · drag-sort · haptics</Text>
      </View>

      {phase === 'modal' && (
        <View style={styles.modalWrap} pointerEvents="box-none">
          <Animated.View style={[styles.backdrop, { opacity: mOp }]} />
          <Animated.View style={[styles.modalContent, mStyle]}>
            <Text style={styles.stepKicker}>
              {step === 'done' ? 'done' : `step ${step === 'prep' ? 1 : 2} of 2`}
            </Text>
            <Text style={styles.instruction}>{INSTRUCTIONS[step]}</Text>
            {hint && <Text style={styles.hint}>{hint}</Text>}

            {step === 'prep' && (
              <View style={styles.progWrap}>
                <View style={styles.progTrack}>
                  <Animated.View style={[styles.progFill, twistBar]} />
                </View>
              </View>
            )}

            {/* draggable bottle body (live only after parts are off) */}
            <GestureDetector gesture={chipPan('body', bodyTx, bodyTy, BODY.x, BODY.y, BODY.w, BODY.h, bodyLive)}>
              <Animated.View style={[{ position: 'absolute', left: BX - 20, top: BY - 60 }, bodyStyle]}>
                <ModalBottle
                  capX={capX}
                  capY={capY}
                  wrapH={wrapH}
                  flapY={flapY}
                  flapH={flapH}
                  capGone={capGone}
                  wrapGone={wrapGone}
                />
              </Animated.View>
            </GestureDetector>

            {/* twist zone over the cap */}
            {step === 'prep' && !capGone && (
              <GestureDetector gesture={twistGesture}>
                <View style={{ position: 'absolute', left: BX - 10, top: BY - 80, width: 170, height: 120 }} />
              </GestureDetector>
            )}
            {step === 'prep' && !capGone && (
              <View style={{ position: 'absolute', left: SW / 2 - 38, top: BY - 52 }}>
                <Pulse size={76} color={C.gold} />
              </View>
            )}

            {/* peel zone over the wrapper */}
            {step === 'prep' && !wrapGone && (
              <GestureDetector gesture={peelGesture}>
                <View style={{ position: 'absolute', left: BX, top: BY + 60, width: BW, height: 170 }} />
              </GestureDetector>
            )}
            {step === 'prep' && !wrapGone && (
              <View style={{ position: 'absolute', left: SW / 2 - 38, top: BY + 108 }}>
                <Pulse size={76} color={C.gold} />
              </View>
            )}

            {/* parts chips */}
            {capChip && !sortedIds.includes('cap') && (
              <GestureDetector gesture={chipPan('cap', capTx, capTy, CAP.x, CAP.y, CAP.w, CAP.h, null)}>
                <Animated.View style={[styles.chip, { left: CAP.x, top: CAP.y, width: CAP.w, height: CAP.h, backgroundColor: C.cap }, capStyle]}>
                  <Text style={styles.chipLabel}>cap</Text>
                </Animated.View>
              </GestureDetector>
            )}
            {wrapChip && !sortedIds.includes('wrapper') && (
              <GestureDetector gesture={chipPan('wrapper', wrapTx, wrapTy, WRAP.x, WRAP.y, WRAP.w, WRAP.h, null)}>
                <Animated.View style={[styles.chip, { left: WRAP.x, top: WRAP.y, width: WRAP.w, height: WRAP.h, backgroundColor: C.wrapper }, wrapStyle]}>
                  <Text style={styles.chipLabel}>label</Text>
                </Animated.View>
              </GestureDetector>
            )}

            {/* mini bins */}
            <View style={styles.bins}>
              {BINS.map((b) => (
                <View key={b.id} style={[styles.bin, { backgroundColor: b.color }]}>
                  <Text style={styles.binLabel}>{b.label}</Text>
                </View>
              ))}
            </View>

            {bursts.map((bb) => (
              <Burst key={bb.id} x={bb.x} y={bb.y} />
            ))}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: 64, alignItems: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: 6 },
  sub: { fontSize: 13, color: C.sub, marginTop: 4 },
  beltWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  belt: {
    width: SW - 48,
    height: 130,
    backgroundColor: C.belt,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  beltBottle: { padding: 8 },
  tapHint: { marginTop: 26, alignItems: 'center', justifyContent: 'center', height: 90 },
  tapText: { position: 'absolute', fontSize: 14, fontWeight: '700', color: C.ink },
  legend: { paddingBottom: 110, alignItems: 'center' },
  legendText: { fontSize: 12, color: C.sub },
  doneCard: {
    marginTop: 26,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  doneTitle: { fontSize: 18, fontWeight: '800', color: C.ink },
  doneSub: { fontSize: 14, color: C.sub, marginTop: 6 },
  replay: {
    marginTop: 14,
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  replayText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  backdrop: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(46,36,28,0.55)',
  },
  modalContent: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  stepKicker: {
    textAlign: 'center', marginTop: 84, fontSize: 12, fontWeight: '700',
    letterSpacing: 2, color: '#fff', opacity: 0.85,
  },
  instruction: {
    textAlign: 'center', marginTop: 8, fontSize: 19, fontWeight: '800',
    color: '#fff', paddingHorizontal: 40,
  },
  hint: {
    textAlign: 'center', marginTop: 8, fontSize: 15, fontWeight: '600',
    color: '#FFD9A8', paddingHorizontal: 40,
  },
  progWrap: { alignItems: 'center', marginTop: 12 },
  progTrack: {
    width: 220, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden',
  },
  progFill: { height: 10, borderRadius: 5, backgroundColor: C.gold },
  chip: {
    position: 'absolute', borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  chipLabel: { color: '#fff', fontWeight: '800', fontSize: 14 },
  bins: {
    position: 'absolute', left: 0, right: 0, bottom: BIN_BOTTOM,
    flexDirection: 'row', justifyContent: 'center', gap: BIN_GAP,
  },
  bin: {
    width: BIN_W, height: BIN_H, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  binLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
})