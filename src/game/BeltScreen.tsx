import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  C, SW, SH, BIN_W, BIN_H, BIN_GAP, BIN_BOTTOM, binX, binY,
  Burst,
} from '../spike/effects';
import { BINS, ITEM_DEFS, drawItem, ItemDef, BinId } from './items';

/*
 * Phase 2: core belt loop (placeholder art).
 * Belt scrolls right -> left, items spawn, drag them into bins.
 * Correct = streak + burst. Wrong = shake + teaching hint. Fall off the
 * left edge = contamination miss. 20-item shift, then a summary.
 */

const BELT_TOP = 250;
const BELT_H = 120;
const ITEM_S = 64;
const ITEM_Y = BELT_TOP + (BELT_H - ITEM_S) / 2 - 8;
const SPAWN_X = SW + 40;
const MISS_X = -ITEM_S - 24;
const SPEED = 110; // pt/s
const SPAWN_MS = 2600;
const SHIFT_ITEMS = 20;
const CHEV_GAP = 44;

interface BinRect { x: number; y: number; w: number; h: number }

function ItemGlyph({ def }: { def: ItemDef }) {
  const base = {
    width: 56,
    height: 56,
    backgroundColor: def.color,
    borderWidth: 3,
    borderColor: 'rgba(74,63,53,0.35)',
  };
  if (def.shape === 'circle') return <View style={[base, { borderRadius: 28 }]} />;
  if (def.shape === 'diamond')
    return <View style={[base, { borderRadius: 12, transform: [{ rotate: '45deg' }, { scale: 0.8 }] }]} />;
  return <View style={[base, { borderRadius: 12 }]} />;
}

function BeltItem({
  itemKey,
  def,
  binRects,
  onDrop,
  onMissed,
}: {
  itemKey: number;
  def: ItemDef;
  binRects: any;
  onDrop: (key: number, defId: string, binIdx: number, x: number, y: number) => void;
  onMissed: (key: number, defId: string) => void;
}) {
  const bx = useSharedValue(SPAWN_X);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const settled = useSharedValue(false);

  useEffect(() => {
    const dist = SPAWN_X - MISS_X;
    bx.value = withTiming(MISS_X, { duration: (dist / SPEED) * 1000, easing: Easing.linear }, (finished) => {
      if (finished && !settled.value) {
        settled.value = true;
        runOnJS(onMissed)(itemKey, def.id);
      }
    });
  }, []);

  const hitBin = (cx: number, cy: number) => {
    'worklet';
    const rs: BinRect[] = binRects.value;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (cx >= r.x - 10 && cx <= r.x + r.w + 10 && cy >= r.y - 10 && cy <= r.y + r.h + 10) return i;
    }
    return -1;
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      // detach from the belt: freeze travel so the item stays under the finger
      bx.value = bx.value;
    })
    .onUpdate((e) => {
      dx.value = e.translationX;
      dy.value = e.translationY;
    })
    .onEnd((e) => {
      const cx = bx.value + e.translationX + ITEM_S / 2;
      const cy = ITEM_Y + e.translationY + ITEM_S / 2;
      const hit = hitBin(cx, cy);
      if (hit >= 0) {
        settled.value = true;
        runOnJS(onDrop)(itemKey, def.id, hit, cx, cy);
      } else {
        dx.value = withSpring(0, { damping: 18 });
        dy.value = withSpring(0, { damping: 18 });
        // resume belt travel from the frozen position
        const dist = bx.value - MISS_X;
        bx.value = withTiming(MISS_X, { duration: (dist / SPEED) * 1000, easing: Easing.linear }, (finished) => {
          if (finished && !settled.value) {
            settled.value = true;
            runOnJS(onMissed)(itemKey, def.id);
          }
        });
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

  const keyRef = useRef(0);
  const spawnedRef = useRef(0);
  const streakRef = useRef(0);
  const burstId = useRef(0);

  const binRects = useSharedValue<BinRect[]>([]);
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

  // item spawner (re-armed on every replay via runId)
  useEffect(() => {
    spawnedRef.current = 0;
    const t = setInterval(() => {
      if (spawnedRef.current >= SHIFT_ITEMS) {
        clearInterval(t);
        return;
      }
      spawnedRef.current += 1;
      const def = drawItem();
      const key = ++keyRef.current;
      setItems((prev) => [...prev, { key, def }]);
    }, SPAWN_MS);
    return () => clearInterval(t);
  }, [runId]);

  // shift end
  useEffect(() => {
    if (resolved >= SHIFT_ITEMS && !done) {
      const t = setTimeout(() => {
        setDone(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [resolved, done]);

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

  const handleDrop = (key: number, defId: string, binIdx: number, x: number, y: number) => {
    const def = ITEM_DEFS.find((d) => d.id === defId)!;
    setItems((prev) => prev.filter((i) => i.key !== key));
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
    setMissed((m) => m + 1);
    streakRef.current = 0;
    setStreak(0);
    setHint('Missed — that contaminates the line');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    flashMiss();
    setResolved((r) => r + 1);
  };

  const replay = () => {
    keyRef.current = 0;
    streakRef.current = 0;
    setItems([]);
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
      {hint && <Text style={styles.hint}>{hint}</Text>}

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
          onDrop={handleDrop}
          onMissed={handleMissed}
        />
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
