import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  C, SW, SH, BX, BY, BW, BH,
  BIN_W, BIN_H, BIN_GAP, BIN_BOTTOM, binX, binY,
  Pulse, Burst,
} from '../spike/effects';
import { ModalBottle } from '../spike/BottleArt';
import { BINS, BinId, ItemDef, PartDef } from './items';
import { hitBinPoint } from './binHit';

/*
 * Phase 3: production disassembly modal.
 * Rebuilt from the phase-1 spike with the approved feel intact:
 * calm ease-out zoom from the drop point, one-finger circular twist
 * (cap rises as it unscrews, ratchet ticks), drag-down peel, un-gated
 * either-order prep, in-modal bins, auto-dismiss.
 * New: belt ticker (next 3 queued items + red edge on near fall-off)
 * and the pause-when-learning pill.
 * Bottle parts -> Portland 3-stream: cap -> Recycle, wrapper(film) ->
 * Landfill, body -> Recycle.
 */

const TWIST_TARGET = Math.PI * 1.25;
const PEEL_DIST = 150;

type PartId = 'cap' | 'wrapper' | 'body';

const CAP = { x: BX + 43, y: BY - 53, w: 64, h: 40 };
const WRAP = { x: BX + 10, y: BY + 94, w: 130, h: 84 };
const BODY = { x: BX, y: BY, w: BW, h: BH };

export function DisassemblyModal({
  origin,
  paused,
  ticker,
  danger,
  parts,
  onClose,
}: {
  origin: { x: number; y: number };
  paused: boolean;
  ticker: ItemDef[];
  danger: boolean;
  parts: PartDef[];
  onClose: (allCorrect: boolean) => void;
}) {
  // part -> bin mapping comes from the item record (data-driven since phase 5)
  const binIndex = (b: BinId) => BINS.findIndex((x) => x.id === b);
  const PART_BIN: Record<PartId, number> = Object.fromEntries(
    parts.map((p) => [p.id, binIndex(p.bin)]),
  ) as Record<PartId, number>;
  const PART_HINT: Record<PartId, string> = Object.fromEntries(
    parts.map((p) => [p.id, p.hint]),
  ) as Record<PartId, string>;
  const PART_LABEL: Record<PartId, string> = Object.fromEntries(
    parts.map((p) => [p.id, p.label]),
  ) as Record<PartId, string>;
  const [step, setStep] = useState<'prep' | 'sort' | 'done'>('prep');
  const [capGone, setCapGone] = useState(false);
  const [wrapGone, setWrapGone] = useState(false);
  const [capChip, setCapChip] = useState(false);
  const [wrapChip, setWrapChip] = useState(false);
  const [sortedIds, setSortedIds] = useState<PartId[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const burstId = useRef(0);
  const wrongRef = useRef(0);

  // zoom from the drop point (calm ease-out, no bounce)
  const mScale = useSharedValue(0.25);
  const mOp = useSharedValue(0);
  const mTx = useSharedValue(origin.x - SW / 2);
  const mTy = useSharedValue(origin.y - SH / 2);
  const mStyle = useAnimatedStyle(() => ({
    opacity: mOp.value,
    transform: [{ translateX: mTx.value }, { translateY: mTy.value }, { scale: mScale.value }],
  }));
  useEffect(() => {
    const e = Easing.out(Easing.cubic);
    mTx.value = withTiming(0, { duration: 380, easing: e });
    mTy.value = withTiming(0, { duration: 380, easing: e });
    mScale.value = withTiming(1, { duration: 380, easing: e });
    mOp.value = withTiming(1, { duration: 180 });
  }, []);

  // twist + peel progress
  const twistProg = useSharedValue(0);
  const peelProg = useSharedValue(0);
  const capWig = useSharedValue(0);
  const accRot = useSharedValue(0);
  const lastAng = useSharedValue(0);
  const hasAng = useSharedValue(false);
  const lastTick = useSharedValue(0);
  const peelStart = useSharedValue(0);
  const twistLive = useSharedValue(true);
  const peelLive = useSharedValue(true);
  const bodyLive = useSharedValue(false);

  const wrapH = useDerivedValue(() => 92 * (1 - peelProg.value));
  const flapH = useDerivedValue(() => 92 * peelProg.value);
  const flapY = useDerivedValue(() => 150 + 92 * (1 - peelProg.value));
  const capX = useDerivedValue(() => 65 + capWig.value);
  const capY = useDerivedValue(() => 8 - twistProg.value * 14);
  const twistBar = useAnimatedStyle(() => ({ width: twistProg.value * 220 }));

  // chip drag positions
  const capTx = useSharedValue(0);
  const capTy = useSharedValue(0);
  const wrapTx = useSharedValue(0);
  const wrapTy = useSharedValue(0);
  const bodyTx = useSharedValue(0);
  const bodyTy = useSharedValue(0);
  const TX: Record<PartId, { tx: any; ty: any }> = {
    cap: { tx: capTx, ty: capTy },
    wrapper: { tx: wrapTx, ty: wrapTy },
    body: { tx: bodyTx, ty: bodyTy },
  };

  const binRects = useSharedValue<{ x: number; y: number; w: number; h: number }[]>([]);
  useEffect(() => {
    binRects.value = [0, 1, 2].map((i) => ({ x: binX(i), y: binY, w: BIN_W, h: BIN_H }));
  }, []);

  // named fn on the JS side: worklets can't schedule inline closures
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

  const chipSorted = (id: PartId, x: number, y: number) => {
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
          setTimeout(() => onClose(wrongRef.current === 0), 1100);
        }, 650);
      }
      return n;
    });
  };

  const chipWrong = (id: PartId) => {
    wrongRef.current += 1;
    setHint(PART_HINT[id]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const t = TX[id];
    t.tx.value = withSequence(
      withTiming(-12, { duration: 55 }),
      withTiming(12, { duration: 55 }),
      withSpring(0),
    );
    t.ty.value = withSpring(0);
  };

  // ---- gestures (bin hit-test is the shared ./binHit helper) ----
  // one-finger circular twist; cap center in the 170x120 twist zone = (85, 47)
  const twistGesture = Gesture.Pan()
    .onBegin(() => {
      hasAng.value = false;
    })
    .onUpdate((e) => {
      if (!twistLive.value) return;
      const dx = e.x - 85;
      const dy = e.y - 47;
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
    id: PartId,
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
        // drop location = where the finger released (screen coords)
        const fx = e.absoluteX;
        const fy = e.absoluteY;
        const hit = hitBinPoint(binRects, fx, fy);
        if (hit === PART_BIN[id]) runOnJS(chipSorted)(id, fx, fy);
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
    <View style={styles.modalWrap} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: mOp }]} />
      <Animated.View style={[styles.modalContent, mStyle]}>
        <Text style={styles.stepKicker}>
          {step === 'done' ? 'done' : step === 'prep' ? 'step 1 of 2 · prep' : 'step 2 of 2 · sort'}
        </Text>

        {/* belt ticker: next 3 queued items + red edge on near fall-off */}
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
                      { backgroundColor: t.color, borderRadius: t.shape === 'circle' ? 12 : 6 },
                      t.shape === 'diamond' && styles.tickerDiamond,
                    ]}
                  />
                  <Text style={styles.tickerName} numberOfLines={1}>{t.name}</Text>
                </View>
              ) : null,
            )}
          </View>
        </View>

        {paused && (
          <View style={styles.pausedPill}>
            <Text style={styles.pausedText}>Belt paused — take your time</Text>
          </View>
        )}

        <Text style={styles.instruction}>
          {step === 'prep'
            ? 'Twist the cap and peel the wrapper — either order'
            : step === 'sort'
              ? 'Sort the parts — drag each to its bin'
              : 'Nice work!'}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}

        {step === 'prep' && (
          <View style={styles.progWrap}>
            <View style={styles.progTrack}>
              <Animated.View style={[styles.progFill, twistBar]} />
            </View>
          </View>
        )}

        {/* bottle body (draggable once parts are off; unmounts when sorted) */}
        {!sortedIds.includes('body') && (
          <GestureDetector gesture={chipPan('body', bodyTx, bodyTy, BX - 20, BY - 60, 190, 380, bodyLive)}>
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
        )}

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
              <Text style={styles.chipLabel}>{PART_LABEL.cap ?? 'cap'}</Text>
            </Animated.View>
          </GestureDetector>
        )}
        {wrapChip && !sortedIds.includes('wrapper') && (
          <GestureDetector gesture={chipPan('wrapper', wrapTx, wrapTy, WRAP.x, WRAP.y, WRAP.w, WRAP.h, null)}>
            <Animated.View style={[styles.chip, { left: WRAP.x, top: WRAP.y, width: WRAP.w, height: WRAP.h, backgroundColor: C.wrapper }, wrapStyle]}>
              <Text style={styles.chipLabel}>{PART_LABEL.wrapper ?? 'label'}</Text>
            </Animated.View>
          </GestureDetector>
        )}

        {/* in-modal bins (same 3 streams as the main screen) */}
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
  );
}

const styles = StyleSheet.create({
  modalWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  backdrop: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(46,36,28,0.55)',
  },
  modalContent: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  stepKicker: {
    textAlign: 'center', marginTop: 74, fontSize: 12, fontWeight: '700',
    letterSpacing: 2, color: '#fff', opacity: 0.85,
  },
  ticker: {
    marginTop: 10,
    marginHorizontal: 40,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  tickerDanger: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 8,
    backgroundColor: '#E05A4B',
  },
  tickerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: 'rgba(255,255,255,0.7)' },
  tickerRow: { flexDirection: 'row', marginTop: 6, gap: 14 },
  tickerItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  tickerDot: { width: 24, height: 24 },
  tickerDiamond: { transform: [{ rotate: '45deg' }] },
  tickerName: { fontSize: 11, fontWeight: '600', color: '#fff', flexShrink: 1 },
  pausedPill: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  pausedText: { fontSize: 13, fontWeight: '700', color: C.ink },
  instruction: {
    textAlign: 'center', marginTop: 10, fontSize: 18, fontWeight: '800',
    color: '#fff', paddingHorizontal: 40,
  },
  hint: {
    textAlign: 'center', marginTop: 8, fontSize: 15, fontWeight: '600',
    color: '#FFD9A8', paddingHorizontal: 40,
  },
  progWrap: { alignItems: 'center', marginTop: 10 },
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