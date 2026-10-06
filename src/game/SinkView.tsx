import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { SW } from '../spike/effects';
import { ItemDef } from './items';
import { ItemGlyph } from './ItemGlyph';
import { BinRect, hitBinPoint } from './binHit';

/*
 * Phase 4: passive rinse sink. Three slots; dirty items soak here while the
 * belt keeps moving. Four pie quarters fill passively (~15s); all green +
 * haptic tick when done. Drag the clean item out to its bin.
 *
 * Each slot owns its own progress clock so the rinse tick never re-renders
 * the belt screen (recreating every item's gesture mid-drag).
 */

export const SINK_TOP = 552;
export const SLOT_S = 92;
export const SLOT_GAP = 16;
export const RINSE_SECS = 15;

export const slotX = (i: number) =>
  (SW - (3 * SLOT_S + 2 * SLOT_GAP)) / 2 + i * (SLOT_S + SLOT_GAP);

export const sinkRects: BinRect[] = [0, 1, 2].map((i) => ({
  x: slotX(i),
  y: SINK_TOP,
  w: SLOT_S,
  h: SLOT_S,
}));

export interface SinkItem {
  key: number;
  def: ItemDef;
}

/* Four-quarter pie: each quarter fills continuously as its turn comes,
   so the pie starts moving the instant the item lands; all green when done. */
function RinsePie({ progress, size = 76 }: { progress: number; size?: number }) {
  const done = progress >= 1;
  const r = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const quarters = [0, 1, 2, 3]
    .map((i) => {
      const frac = Math.min(1, Math.max(0, progress * 4 - i));
      if (frac <= 0) return null;
      const p = Skia.Path.Make();
      p.moveTo(cx, cy);
      p.addArc({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }, -90 + i * 90, frac * 90);
      p.close();
      return p;
    })
    .filter(Boolean);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Circle cx={cx} cy={cy} r={r} color="#EFE6D2" />
      {quarters.map((p, i) => (
        <Path key={i} path={p!} color={done ? '#7FB069' : '#E8A13D'} />
      ))}
    </Canvas>
  );
}

export function SinkSlot({
  slot,
  index,
  binRects,
  onCleanDrop,
}: {
  slot: SinkItem | null;
  index: number;
  binRects: { value: BinRect[] };
  onCleanDrop: (slotKey: number, defId: string, binIdx: number, x: number, y: number) => void;
}) {
  const [progress, setProgress] = useState(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const wasDone = useRef(false);
  const done = progress >= 1;

  // fresh item -> restart the soak
  useEffect(() => {
    setProgress(0);
    wasDone.current = false;
    tx.value = 0;
    ty.value = 0;
  }, [slot?.key]);

  // passive rinse clock (per-slot, never touches the belt screen)
  const isSoaking = !!slot && !done;
  useEffect(() => {
    if (!isSoaking) return;
    const t = setInterval(() => {
      setProgress((p) => Math.min(1, p + 0.1 / RINSE_SECS));
    }, 100);
    return () => clearInterval(t);
  }, [isSoaking]);

  // completion tick
  useEffect(() => {
    if (done && !wasDone.current && slot) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    wasDone.current = done;
  }, [done, slot]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (!done) return;
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      if (!done || !slot) return;
      const hit = hitBinPoint(binRects, e.absoluteX, e.absoluteY);
      if (hit >= 0) {
        runOnJS(onCleanDrop)(slot.key, slot.def.id, hit, e.absoluteX, e.absoluteY);
      } else {
        tx.value = withSpring(0, { damping: 18 });
        ty.value = withSpring(0, { damping: 18 });
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <View style={[styles.slot, { left: slotX(index), top: SINK_TOP }]}>
      {!slot ? (
        <View style={styles.empty} />
      ) : (
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.inner, dragStyle]}>
            <RinsePie progress={progress} />
            <View style={styles.glyph}>
              <ItemGlyph def={slot.def} size={44} />
            </View>
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    width: SLOT_S,
    height: SLOT_S,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    width: SLOT_S - 8,
    height: SLOT_S - 8,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#C9B998',
    backgroundColor: 'rgba(123,174,110,0.07)',
  },
  inner: {
    width: SLOT_S,
    height: SLOT_S,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glyph: {
    position: 'absolute',
  },
});
