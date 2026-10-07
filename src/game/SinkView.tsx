import { palette } from "@/constants/theme";
import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SW } from "../spike/effects";
import { ItemGlyph } from "./ItemGlyph";
import { BinRect, hitBinPoint } from "./binHit";
import { ItemDef } from "./items";

/*
 * Phase 6 (rework): one big FIFO sink. Unlimited dirty intake; items rinse
 * one at a time (~15s each) in drop order. Finished items stage on the
 * side rack (cap 4) for drag-out sorting.
 *
 * The basin owns the rinse clock so the tick never re-renders the belt
 * screen (recreating every item's gesture mid-drag).
 */

export const SINK_TOP = 400;
export const RINSE_SECS = 15;
export const RACK_CAP = 4;

// work area: sink top-left, a row of 4 rack slots below it,
// prep tray right (3:4)
export const ZONE = { x: 24, y: 472, w: SW - 48, h: 224 };
const Z_GAP = 12;
const COL_W = (ZONE.w - Z_GAP) / 2;
const ROW_H = (ZONE.h - Z_GAP) / 2;
export const SINK_RECT = { x: ZONE.x, y: ZONE.y, w: COL_W, h: ROW_H + 96 };
export const TRAY_RECT = {
  x: ZONE.x + COL_W + Z_GAP,
  y: ZONE.y,
  w: COL_W,
  h: (COL_W * 4) / 3,
};

// basin sits on the sink section; the rack is a plain row of 4 slots
// below the sink (no art). basinRect is the dirty-item drop target.
export const BASIN = { ...SINK_RECT };
const RACK_S = 35;
const RACK_GAP = 8;
export const RACK = {
  x: ZONE.x + 12,
  y: SINK_RECT.y + SINK_RECT.h + Z_GAP - 8,
  w: 4 * RACK_S + 3 * RACK_GAP,
  h: RACK_S,
};
export const basinRect: BinRect = {
  x: BASIN.x,
  y: BASIN.y,
  w: BASIN.w,
  h: BASIN.h,
};

const rackSlot = (i: number) => ({
  x: RACK.x + i * (RACK_S + RACK_GAP),
  y: RACK.y,
  s: RACK_S,
});

export type SinkStatus = "queued" | "rinsing" | "done" | "rack";

export interface SinkItem {
  key: number;
  def: ItemDef;
  seq: number;
  status: SinkStatus;
}

/* Four-quarter pie: each quarter fills continuously as its turn comes,
   so the pie starts moving the instant the rinse starts; green when done. */
function RinsePie({
  progress,
  size = 76,
}: {
  progress: number;
  size?: number;
}) {
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
      p.addArc(
        { x: cx - r, y: cy - r, width: r * 2, height: r * 2 },
        -90 + i * 90,
        frac * 90,
      );
      p.close();
      return p;
    })
    .filter(Boolean);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Circle cx={cx} cy={cy} r={r} color="#EFE6D2" />
      {quarters.map((p, i) => (
        <Path key={i} path={p!} color={done ? "#7FB069" : "#E8A13D"} />
      ))}
    </Canvas>
  );
}

export function SinkBasin({
  items,
  onRinseDone,
  paused,
}: {
  items: SinkItem[];
  onRinseDone: (key: number) => void;
  paused: boolean;
}) {
  const rinsing = items.find((i) => i.status === "rinsing");
  const queued = items.filter((i) => i.status === "queued");
  const done = items.filter((i) => i.status === "done");
  const [progress, setProgress] = useState(0);
  const onRinseDoneRef = useRef(onRinseDone);
  onRinseDoneRef.current = onRinseDone;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // passive rinse clock (basin-local, never touches the belt screen).
  // The key is captured in the closure so completion always fires for the
  // item that actually soaked, never a successor on a stale render.
  useEffect(() => {
    if (!rinsing) return;
    const key = rinsing.key;
    let fired = false;
    setProgress(0);
    const t = setInterval(() => {
      if (pausedRef.current) return;
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
    <View
      style={[
        styles.basin,
        { left: BASIN.x, top: BASIN.y, width: BASIN.w, height: BASIN.h },
      ]}
    >
      {rinsing ? (
        <View style={styles.rinsing}>
          <RinsePie progress={progress} size={68} />
          <View style={styles.glyph}>
            <ItemGlyph def={rinsing.def} size={36} />
          </View>
        </View>
      ) : null}
      <View style={styles.queue}>
        {queued.slice(0, 3).map((q) => (
          <View key={q.key} style={styles.qGlyph}>
            <ItemGlyph def={q.def} size={26} />
          </View>
        ))}
        {queued.length > 3 && (
          <Text style={styles.qMore}>+{queued.length - 3}</Text>
        )}
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
  onCleanDrop: (
    key: number,
    defId: string,
    binIdx: number,
    x: number,
    y: number,
  ) => void;
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
        runOnJS(onCleanDrop)(
          item.key,
          item.def.id,
          hit,
          e.absoluteX,
          e.absoluteY,
        );
      } else {
        tx.value = withSpring(0, { damping: 18 });
        ty.value = withSpring(0, { damping: 18 });
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <View
      style={[
        styles.rackSlot,
        { left: s.x, top: s.y, width: s.s, height: s.s },
      ]}
    >
      {item ? (
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.rackInner, dragStyle]}>
            <ItemGlyph def={item.def} size={30} />
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
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
  },
  rinsing: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  glyph: {
    position: "absolute",
  },
  queue: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingRight: 109,
    marginTop: 10,
    gap: 2,
  },
  qGlyph: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  qMore: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7FA3B8",
    marginLeft: 3,
  },
  doneCheck: {
    position: "absolute",
    right: -2,
    bottom: -2,
    fontSize: 14,
    fontWeight: "900",
    color: "#7FB069",
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 2,
  },
  rackSlot: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  rackEmpty: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: palette.gold,
    backgroundColor: palette.oat,
  },
  rackInner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});
