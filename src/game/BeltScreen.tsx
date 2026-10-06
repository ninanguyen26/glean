import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  C, SW, BIN_W, BIN_H, BIN_GAP, BIN_BOTTOM, binX, binY,
  Burst,
} from '../spike/effects';
import { BINS, ITEM_DEFS, BOTTLE_DEF, drawItem, ItemDef } from './items';
import { ItemGlyph } from './ItemGlyph';
import { BinRect } from './binHit';
import { DisassemblyModal } from './DisassemblyModal';
import { SinkSlot, SinkItem, sinkRects, SINK_TOP } from './SinkView';

/*
 * Phase 4: belt loop + disassembly modal + passive rinse sink.
 * - Dirty items (needsRinse) must soak in the sink before their bin.
 * - Sink: 3 slots, passive ~15s, 4 pie quarters -> green + haptic when done.
 * - Drag the clean item out of its slot to sort it.
 */

const BELT_TOP = 250;
const BELT_H = 120;
const ITEM_S = 64;
const ITEM_Y = BELT_TOP + (BELT_H - ITEM_S) / 2 - 8;
const SPAWN_X = SW + 40;
const MISS_X = -ITEM_S - 24;
const DANGER_X = 70;
const SPEED = 110; // pt/s
const SPAWN_MS = 2600;
const SHIFT_ITEMS = 20;
const CHEV_GAP = 44;

// prep drop zone (main screen, between belt and sink)
const PREP = { x: SW / 2 - 110, y: 432, w: 220, h: 92 };

function BeltItem({
  itemKey,
  def,
  binRects,
  prepRect,
  paused,
  sinkTaken,
  onDrop,
  onMissed,
  onPrep,
  onDanger,
  onSink,
  onBottleNeedsPrep,
  onPrepHint,
  onRinseHint,
  onBottleSinkHint,
  onSinkBusyHint,
  onCleanHint,
}: {
  itemKey: number;
  def: ItemDef;
  binRects: any;
  prepRect: BinRect;
  paused: boolean;
  sinkTaken: { value: boolean[] };
  onDrop: (key: number, defId: string, binIdx: number, x: number, y: number) => void;
  onMissed: (key: number, defId: string) => void;
  onPrep: (key: number, defId: string, x: number, y: number) => void;
  onDanger: (key: number) => void;
  onSink: (key: number, defId: string, slotIdx: number, x: number, y: number) => void;
  onBottleNeedsPrep: () => void;
  onPrepHint: () => void;
  onRinseHint: () => void;
  onBottleSinkHint: () => void;
  onSinkBusyHint: () => void;
  onCleanHint: () => void;
}) {
  const bx = useSharedValue(SPAWN_X);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const settled = useSharedValue(false);
  const dangerSent = useSharedValue(false);

  const startTravel = () => {
    'worklet';
    const dist = bx.value - MISS_X;
    if (dist <= 0) return;
    bx.value = withTiming(MISS_X, { duration: (dist / SPEED) * 1000, easing: Easing.linear }, (finished) => {
      if (finished && !settled.value) {
        settled.value = true;
        runOnJS(onMissed)(itemKey, def.id);
      }
    });
  };

  useEffect(() => {
    startTravel();
  }, []);

  // pause-when-learning: freeze on pause, resume on unpause
  useEffect(() => {
    if (paused) {
      bx.value = bx.value;
    } else if (!settled.value) {
      startTravel();
    }
  }, [paused]);

  // report when nearing fall-off (drives the modal ticker's red edge)
  useAnimatedReaction(
    () => bx.value,
    (x) => {
      if (x < DANGER_X && !dangerSent.value) {
        dangerSent.value = true;
        runOnJS(onDanger)(itemKey);
      }
    },
  );

  const inPrep = (cx: number, cy: number) => {
    'worklet';
    const r = prepRect;
    return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
  };

  const hitBin = (cx: number, cy: number) => {
    'worklet';
    const rs: BinRect[] = binRects.value;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (cx >= r.x - 10 && cx <= r.x + r.w + 10 && cy >= r.y - 10 && cy <= r.y + r.h + 10) return i;
    }
    return -1;
  };

  const hitSink = (cx: number, cy: number) => {
    'worklet';
    for (let i = 0; i < sinkRects.length; i++) {
      const r = sinkRects[i];
      if (cx >= r.x - 8 && cx <= r.x + r.w + 8 && cy >= r.y - 8 && cy <= r.y + r.h + 8) return i;
    }
    return -1;
  };

  const bounce = () => {
    'worklet';
    dx.value = withSpring(0, { damping: 18 });
    dy.value = withSpring(0, { damping: 18 });
    if (!paused) startTravel();
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      bx.value = bx.value; // detach from the belt while held
    })
    .onUpdate((e) => {
      dx.value = e.translationX;
      dy.value = e.translationY;
    })
    .onEnd((e) => {
      const cx = bx.value + e.translationX + ITEM_S / 2;
      const cy = ITEM_Y + e.translationY + ITEM_S / 2;
      const prepHit = inPrep(cx, cy);
      const binHit = hitBin(cx, cy);
      const sinkHit = hitSink(cx, cy);
      if (def.complex) {
        if (prepHit) {
          settled.value = true;
          runOnJS(onPrep)(itemKey, def.id, cx, cy);
        } else {
          bounce();
          if (binHit >= 0) runOnJS(onBottleNeedsPrep)();
          else if (sinkHit >= 0) runOnJS(onBottleSinkHint)();
        }
        return;
      }
      if (def.needsRinse) {
        if (sinkHit >= 0 && !sinkTaken.value[sinkHit]) {
          settled.value = true;
          runOnJS(onSink)(itemKey, def.id, sinkHit, cx, cy);
        } else {
          bounce();
          if (sinkHit >= 0) runOnJS(onSinkBusyHint)();
          else if (binHit >= 0) runOnJS(onRinseHint)();
          else if (prepHit) runOnJS(onPrepHint)();
        }
        return;
      }
      if (binHit >= 0) {
        settled.value = true;
        runOnJS(onDrop)(itemKey, def.id, binHit, cx, cy);
      } else {
        bounce();
        if (prepHit) runOnJS(onPrepHint)();
        else if (sinkHit >= 0) runOnJS(onCleanHint)();
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: bx.value + dx.value }, { translateY: dy.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.item, { top: ITEM_Y }, style]}>
        <ItemGlyph def={def} />
        <Text style={styles.itemLabel} numberOfLines={1}>{def.name}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

export function BeltScreen() {
  const [items, setItems] = useState<{ key: number; def: ItemDef }[]>([]);
  const [resolved, setResolved] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [done, setDone] = useState(false);
  const [runId, setRunId] = useState(0);
  const [modal, setModal] = useState<{ x: number; y: number; paused: boolean } | null>(null);
  // derived, never separate state: the belt is paused exactly while a pausing modal is open,
  // so the flag can't stick if the modal ever goes away by another path
  const beltPaused = modal?.paused ?? false;
  const [danger, setDanger] = useState(false);
  const [sinkSlots, setSinkSlots] = useState<(SinkItem | null)[]>([null, null, null]);

  const keyRef = useRef(0);
  const streakRef = useRef(0);
  const burstId = useRef(0);
  const queueRef = useRef<ItemDef[]>([]);
  const dangerKeysRef = useRef<Set<number>>(new Set());
  const twistEncounters = useRef(0);
  const peelEncounters = useRef(0);

  const binRects = useSharedValue<BinRect[]>([]);
  const sinkTaken = useSharedValue<boolean[]>([false, false, false]);
  const missFlash = useSharedValue(0);
  const scroll = useSharedValue(0);

  useEffect(() => {
    binRects.value = [0, 1, 2].map((i) => ({ x: binX(i), y: binY, w: BIN_W, h: BIN_H }));
    scroll.value = withRepeat(
      withTiming(-CHEV_GAP, { duration: 450, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const buildQueue = (): ItemDef[] => {
    const q: ItemDef[] = [];
    for (let i = 0; i < SHIFT_ITEMS; i++) {
      q.push(i === 5 || i === 13 ? BOTTLE_DEF : drawItem());
    }
    return q;
  };

  // fresh queue per run
  useEffect(() => {
    queueRef.current = buildQueue();
  }, [runId]);

  // spawner (dead while the belt is paused for learning)
  useEffect(() => {
    if (beltPaused) return;
    const t = setInterval(() => {
      const q = queueRef.current;
      if (q.length === 0) {
        clearInterval(t);
        return;
      }
      const def = q.shift()!;
      const key = ++keyRef.current;
      setItems((prev) => [...prev, { key, def }]);
    }, SPAWN_MS);
    return () => clearInterval(t);
  }, [runId, beltPaused]);

  // sink occupancy mirror for the belt items' worklets
  useEffect(() => {
    sinkTaken.value = sinkSlots.map((s) => !!s);
  }, [sinkSlots]);

  // shift end (waits out an open modal)
  useEffect(() => {
    if (resolved >= SHIFT_ITEMS && !done && !modal) {
      const t = setTimeout(() => {
        setDone(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [resolved, done, modal]);

  const addBurst = (x: number, y: number) => {
    const id = ++burstId.current;
    setBursts((b) => [...b, { id, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((bb) => bb.id !== id)), 750);
  };

  const flashMiss = () => {
    missFlash.value = withSequence(
      withTiming(0.55, { duration: 120 }),
      withTiming(0, { duration: 450 }),
    );
  };

  const clearDanger = (key: number) => {
    dangerKeysRef.current.delete(key);
    setDanger(dangerKeysRef.current.size > 0);
  };

  const handleDanger = (key: number) => {
    dangerKeysRef.current.add(key);
    setDanger(true);
  };

  const handleDrop = (key: number, defId: string, binIdx: number, x: number, y: number) => {
    const def = ITEM_DEFS.find((d) => d.id === defId)!;
    setItems((prev) => prev.filter((i) => i.key !== key));
    clearDanger(key);
    const bin = BINS[binIdx];
    if (bin.id === def.bin) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addBurst(x, y);
      setCorrect((c) => c + 1);
      streakRef.current += 1;
      setStreak(streakRef.current);
      setBestStreak((b) => Math.max(b, streakRef.current));
      setHint(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const right = BINS.find((b) => b.id === def.bin)!;
      setHint(`${def.name} → ${right.label}`);
      streakRef.current = 0;
      setStreak(0);
    }
    setResolved((r) => r + 1);
  };

  const handleMissed = (key: number) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    clearDanger(key);
    setMissed((m) => m + 1);
    streakRef.current = 0;
    setStreak(0);
    setHint('Missed — that contaminates the line');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    flashMiss();
    setResolved((r) => r + 1);
  };

  const handlePrep = (key: number, defId: string, x: number, y: number) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    clearDanger(key);
    const paused = twistEncounters.current < 2 || peelEncounters.current < 2;
    twistEncounters.current += 1;
    peelEncounters.current += 1;
    setModal({ x, y, paused });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleModalClose = (allCorrect: boolean) => {
    setModal(null);
    if (allCorrect) {
      setCorrect((c) => c + 1);
      streakRef.current += 1;
      setStreak(streakRef.current);
      setBestStreak((b) => Math.max(b, streakRef.current));
    } else {
      streakRef.current = 0;
      setStreak(0);
    }
    setHint(null);
    setResolved((r) => r + 1);
  };

  const handleSink = (key: number, defId: string, slotIdx: number, x: number, y: number) => {
    const def = ITEM_DEFS.find((d) => d.id === defId)!;
    setItems((prev) => prev.filter((i) => i.key !== key));
    clearDanger(key);
    setSinkSlots((prev) => prev.map((s, i) => (i === slotIdx ? { key, def } : s)));
    // synchronous mirror: closes the same-frame double-drop race the effect can't see
    sinkTaken.value = sinkTaken.value.map((t, i) => (i === slotIdx ? true : t));
    setHint(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSinkDrop = (slotKey: number, defId: string, binIdx: number, x: number, y: number) => {
    const def = ITEM_DEFS.find((d) => d.id === defId)!;
    setSinkSlots((prev) => prev.map((s) => (s && s.key === slotKey ? null : s)));
    const freed = sinkSlots.findIndex((s) => s && s.key === slotKey);
    if (freed >= 0) sinkTaken.value = sinkTaken.value.map((t, i) => (i === freed ? false : t));
    const bin = BINS[binIdx];
    if (bin.id === def.bin) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addBurst(x, y);
      setCorrect((c) => c + 1);
      streakRef.current += 1;
      setStreak(streakRef.current);
      setBestStreak((b) => Math.max(b, streakRef.current));
      setHint(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const right = BINS.find((b) => b.id === def.bin)!;
      setHint(`${def.name} → ${right.label}`);
      streakRef.current = 0;
      setStreak(0);
    }
    setResolved((r) => r + 1);
  };

  const handleBottleNeedsPrep = () => setHint('Prep the bottle first — drop it in the Prep tray');
  const handlePrepHint = () => setHint('Only bottles need prep');
  const handleRinseHint = () => setHint('Rinse it first — drop it in the sink');
  const handleBottleSinkHint = () => setHint('Bottles go to the Prep tray');
  const handleSinkBusyHint = () => setHint("That slot's busy");
  const handleCleanHint = () => setHint("That one's already clean");

  const replay = () => {
    keyRef.current = 0;
    streakRef.current = 0;
    dangerKeysRef.current.clear();
    setDanger(false);
    setItems([]);
    setSinkSlots([null, null, null]);
    setResolved(0);
    setCorrect(0);
    setMissed(0);
    setStreak(0);
    setBestStreak(0);
    setHint(null);
    setBursts([]);
    setDone(false);
    setRunId((r) => r + 1);
  };

  const chevStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scroll.value }],
  }));
  const missStyle = useAnimatedStyle(() => ({
    opacity: missFlash.value,
  }));

  const accuracy = resolved > 0 ? correct / resolved : 0;
  const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;
  const waitingOnSink =
    !done && queueRef.current.length === 0 && items.length === 0 && sinkSlots.some(Boolean);

  return (
    <View style={styles.root}>
      {/* HUD */}
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudTitle}>SHIFT 1</Text>
          <Text style={styles.hudSub}>{resolved}/{SHIFT_ITEMS} sorted</Text>
        </View>
        <View style={styles.streakWrap}>
          <Text style={styles.streak}>{streak > 1 ? `🔥 ×${streak}` : ' '}</Text>
        </View>
      </View>
      {(hint || waitingOnSink) && (
        <Text style={styles.hint}>
          {hint ?? 'Finish the rinse — drag clean items to their bins'}
        </Text>
      )}

      {/* belt */}
      <View style={[styles.belt, { top: BELT_TOP, height: BELT_H }]}>
        <Animated.View style={[styles.chevStrip, chevStyle]}>
          {Array.from({ length: Math.ceil((SW + CHEV_GAP * 2) / CHEV_GAP) }).map((_, i) => (
            <Text key={i} style={styles.chev}>›</Text>
          ))}
        </Animated.View>
        <Animated.View style={[styles.missEdge, missStyle]} pointerEvents="none" />
      </View>

      {/* items */}
      {items.map((it) => (
        <BeltItem
          key={it.key}
          itemKey={it.key}
          def={it.def}
          binRects={binRects}
          prepRect={PREP}
          paused={beltPaused}
          sinkTaken={sinkTaken}
          onDrop={handleDrop}
          onMissed={handleMissed}
          onPrep={handlePrep}
          onDanger={handleDanger}
          onSink={handleSink}
          onBottleNeedsPrep={handleBottleNeedsPrep}
          onPrepHint={handlePrepHint}
          onRinseHint={handleRinseHint}
          onBottleSinkHint={handleBottleSinkHint}
          onSinkBusyHint={handleSinkBusyHint}
          onCleanHint={handleCleanHint}
        />
      ))}

      {/* prep drop zone */}
      <View style={[styles.prep, { left: PREP.x, top: PREP.y, width: PREP.w, height: PREP.h }]} pointerEvents="none">
        <Text style={styles.prepLabel}>PREP</Text>
        <Text style={styles.prepSub}>bottles go here</Text>
      </View>

      {/* rinse sink */}
      <Text style={[styles.sinkLabel, { top: SINK_TOP - 26 }]}>RINSE</Text>
      {sinkSlots.map((s, i) => (
        <SinkSlot key={i} slot={s} index={i} binRects={binRects} onCleanDrop={handleSinkDrop} />
      ))}

      {/* bins */}
      <View style={styles.bins}>
        {BINS.map((b) => (
          <View key={b.id} style={[styles.bin, { backgroundColor: b.color }]}>
            <Text style={styles.binLabel}>{b.label}</Text>
          </View>
        ))}
      </View>

      {/* bursts */}
      {bursts.map((bb) => (
        <Burst key={bb.id} x={bb.x} y={bb.y} />
      ))}

      {/* disassembly modal */}
      {modal && (
        <DisassemblyModal
          origin={{ x: modal.x, y: modal.y }}
          paused={modal.paused}
          ticker={queueRef.current.slice(0, 3)}
          danger={danger}
          onClose={handleModalClose}
        />
      )}

      {/* summary */}
      {done && (
        <View style={styles.summaryWrap}>
          <View style={styles.summary}>
            <Text style={styles.sumKicker}>SHIFT COMPLETE</Text>
            <Text style={styles.sumStars}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</Text>
            <Text style={styles.sumLine}>Accuracy  {Math.round(accuracy * 100)}%</Text>
            <Text style={styles.sumLine}>Best streak  ×{bestStreak}</Text>
            <Text style={styles.sumLine}>Missed  {missed}</Text>
            <Pressable onPress={replay} style={styles.replay}>
              <Text style={styles.replayText}>Run it again</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  hud: {
    paddingTop: 64,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  hudTitle: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: 3 },
  hudSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  streakWrap: { minWidth: 80, alignItems: 'flex-end' },
  streak: { fontSize: 20, fontWeight: '800', color: C.ink },
  hint: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#B3541E',
    paddingHorizontal: 40,
    minHeight: 20,
  },
  belt: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: C.belt,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  chevStrip: {
    position: 'absolute',
    left: -CHEV_GAP,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chev: {
    width: CHEV_GAP,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    color: 'rgba(250,243,232,0.28)',
  },
  missEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 26,
    backgroundColor: '#D95F4B',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  item: {
    position: 'absolute',
    left: 0,
    width: ITEM_S + 16,
    alignItems: 'center',
  },
  itemLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: C.ink,
    backgroundColor: 'rgba(250,243,232,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  prep: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#B9A88F',
    borderRadius: 16,
    backgroundColor: 'rgba(232,161,61,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prepLabel: { fontSize: 15, fontWeight: '800', letterSpacing: 4, color: '#A08C6D' },
  prepSub: { fontSize: 11, color: '#A08C6D', marginTop: 2 },
  sinkLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#8FAE8B',
  },
  bins: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BIN_BOTTOM,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: BIN_GAP,
  },
  bin: {
    width: BIN_W,
    height: BIN_H,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  binLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
  summaryWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(46,36,28,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: SW - 96,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  sumKicker: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: C.sub },
  sumStars: { fontSize: 40, color: C.gold, marginVertical: 10 },
  sumLine: { fontSize: 16, color: C.ink, marginTop: 4, fontWeight: '600' },
  replay: {
    marginTop: 18,
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingHorizontal: 26,
    paddingVertical: 13,
  },
  replayText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
