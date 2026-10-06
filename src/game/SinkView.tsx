import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
 * Phase 6 (rework): one big FIFO sink. Unlimited dirty intake; items rinse
 * one at a time (~15s each) in drop order. Finished items stage on the
 * side rack (cap 4) for drag-out sorting.
 *
 * The basin owns the rinse clock so the tick never re-renders the belt
 * screen (recreating every item's gesture mid-drag).
 */

export const SINK_TOP = 552;
export const RINSE_SECS = 15;
export const RACK_CAP = 4;

// sink band sits between the PREP tray (ends 524) and the bins (start ~664)
export const BASIN = { x: 24, y: 544, w: 180, h: 108 };
export const RACK = { x: 216, y: 524, w: SW - 240, h: 136 };

// single drop target for dirty items
export const basinRect: BinRect = { x: BASIN.x, y: BASIN.y, w: BASIN.w, h: BASIN.h };

const RACK_S = 50;
const rackSlot = (i: number) => {
  const gw = 2 * RACK_S + 8;
  const ox = RACK.x + (RACK.w - gw) / 2;
  return {
    x: ox + (i % 2) * (RACK_S + 8),
    y: RACK.y + 28 + Math.floor(i / 2) * (RACK_S + 8),
    s: RACK_S,
  };
};

export type SinkStatus = 'queued' | 'rinsing' | 'done' | 'rack';

export interface SinkItem {
  key: number;
  def: ItemDef;
  seq: number;
  status: SinkStatus;
}

/* Four-quarter pie: each quarter fills continuously as its turn comes,
   so the pie starts moving the instant the rinse starts; green when done. */
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

export function SinkBasin({
  items,
  onRinseDone,
}: {
  items: SinkItem[];
  onRinseDone: (key: number) => void;
}) {
  const rinsing = items.find((i) => i.status === 'rinsing');
  const queued = items.filter((i) => i.status === 'queued');
  const done = items.filter((i) => i.status === 'done');
  const [progress, setProgress] = useState(0);
  const onRinseDoneRef = useRef(onRinseDone);
  onRinseDoneRef.current = onRinseDone;

  // passive rinse clock (basin-local, never touches the belt screen).
  // The key is captured in the closure so completion always fires for the
  // item that actually soaked, never a successor on a stale render.
  useEffect(() => {
    if (!rinsing) return;
    const key = rinsing.key;
    let fired = false;
    setProgress(0);
    const t = setInterval(() => {
      setProgress((p) => {
        const n = Math.min(1, p + 0.1 / RINSE_SECS);
        if (n >= 1 && !fired) {
          fired = true;
          clearInterval(t);
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onRinseDoneRef.current(key);
          }, 0);
        }
        return n;
      });
    }, 100);
    return () => clearInterval(t);
  }, [rinsing?.key]);

  return (
    <View style={[styles.basin, { left: BASIN.x, top: BASIN.y, width: BASIN.w, height: BASIN.h }]}>
      <Text style={styles.basinLabel}>SINK</Text>
      {rinsing ? (
        <View style={styles.rinsing}>
          <RinsePie progress={progress} size={68} />
          <View style={styles.glyph}>
            <ItemGlyph def={rinsing.def} size={36} />
          </View>
        </View>
      ) : (
        <View style={styles.rinsing}>
          <Text style={styles.idle}>drop dirty items here</Text>
        </View>
      )}
      <View style={styles.queue}>
        {queued.slice(0, 3).map((q) => (
          <View key={q.key} style={styles.qGlyph}>
            <ItemGlyph def={q.def} size={26} />
          </View>
        ))}
        {queued.length > 3 && <Text style={styles.qMore}>+{queued.length - 3}</Text>}
        {done.map((d) => (
          <View key={d.key} style={styles.qGlyph}>
            <ItemGlyph def={d.def} size={26} />
            <Text style={styles.doneCheck}>✓</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function RackSlot({
  item,
  index,
  binRects,
  onCleanDrop,
}: {
  item: SinkItem | null;
  index: number;
  binRects: { value: BinRect[] };
  onCleanDrop: (key: number, defId: string, binIdx: number, x: number, y: number) => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const s = rackSlot(index);

  // fresh item -> recenter the drag
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
  }, [item?.key]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      if (!item) return;
      const hit = hitBinPoint(binRects, e.absoluteX, e.absoluteY);
      if (hit >= 0) {
        runOnJS(onCleanDrop)(item.key, item.def.id, hit, e.absoluteX, e.absoluteY);
      } else {
        tx.value = withSpring(0, { damping: 18 });
        ty.value = withSpring(0, { damping: 18 });
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <View style={[styles.rackSlot, { left: s.x, top: s.y, width: s.s, height: s.s }]}>
      {item ? (
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.rackInner, dragStyle]}>
            <ItemGlyph def={item.def} size={40} />
          </Animated.View>
        </GestureDetector>
      ) : (
        <View style={styles.rackEmpty} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  basin: {
    position: 'absolute',
    backgroundColor: 'rgba(127,179,213,0.16)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(127,179,213,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  basinLabel: {
    position: 'absolute',
    left: 14,
    top: 6,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#7FA3B8',
  },
  rinsing: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  glyph: {
    position: 'absolute',
  },
  idle: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#7FA3B8',
    lineHeight: 18,
  },
  queue: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingRight: 8,
    marginTop: 10,
    gap: 2,
  },
  qGlyph: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qMore: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7FA3B8',
    marginLeft: 2,
  },
  doneCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    fontSize: 14,
    fontWeight: '900',
    color: '#7FB069',
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 2,
  },
  rackSlot: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rackEmpty: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#C9B998',
    backgroundColor: 'rgba(123,174,110,0.07)',
  },
  rackInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
