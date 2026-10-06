import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  BIN_BOTTOM,
  BIN_GAP,
  BIN_H,
  BIN_W,
  binX,
  binY,
  Burst,
  C,
  SW,
} from "../spike/effects";
import { DisassemblyModal } from "./DisassemblyModal";
import { ItemGlyph } from "./ItemGlyph";
import {
  basinRect,
  RACK,
  RACK_CAP,
  RackSlot,
  SinkBasin,
  SinkItem,
  SinkStatus,
} from "./SinkView";
import { BinRect } from "./binHit";
import {
  drawSeasonal,
  getActiveSeason,
  loadSeasonalItems,
  loadUnionItems,
  markItemSeen,
  SeasonDef,
} from "./db";
import { BINS, GameItem, ItemDef } from "./items";
import { BIN_SPRITES } from "./sprites";

/*
 * Phase 6: belt loop as a parameterized shift — region pool, workweek day
 * or endless score-attack, mistake-as-lesson, result reported to GameRoot.
 */

export interface ShiftResult {
  correct: number;
  total: number;
  missed: number;
  bestStreak: number;
  stars: number;
  lessons: string[];
  score: number;
  sawRare: boolean;
  newBest?: boolean;
}

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
const ENDLESS_LIVES = 3;

// DEBUG: spawn only bottles (skip the full game loop when testing the modal)
const DEBUG_BOTTLE_ONLY = false;

// prep drop zone (main screen, between belt and sink)
const PREP = { x: SW / 2 - 110, y: 432, w: 220, h: 92 };

function BeltItem({
  itemKey,
  def,
  binRects,
  prepRect,
  paused,
  onDrop,
  onMissed,
  onPrep,
  onDanger,
  onSink,
  onBottleNeedsPrep,
  onPrepHint,
  onRinseHint,
  onBottleSinkHint,
  onCleanHint,
}: {
  itemKey: number;
  def: ItemDef;
  binRects: any;
  prepRect: BinRect;
  paused: boolean;
  onDrop: (
    key: number,
    defId: string,
    binIdx: number,
    x: number,
    y: number,
  ) => void;
  onMissed: (key: number, defId: string) => void;
  onPrep: (key: number, def: GameItem, x: number, y: number) => void;
  onDanger: (key: number) => void;
  onSink: (key: number, defId: string, x: number, y: number) => void;
  onBottleNeedsPrep: () => void;
  onPrepHint: () => void;
  onRinseHint: () => void;
  onBottleSinkHint: () => void;
  onCleanHint: () => void;
}) {
  const bx = useSharedValue(SPAWN_X);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const settled = useSharedValue(false);
  const dangerSent = useSharedValue(false);

  const startTravel = () => {
    "worklet";
    const dist = bx.value - MISS_X;
    if (dist <= 0) return;
    bx.value = withTiming(
      MISS_X,
      { duration: (dist / SPEED) * 1000, easing: Easing.linear },
      (finished) => {
        if (finished && !settled.value) {
          settled.value = true;
          runOnJS(onMissed)(itemKey, def.id);
        }
      },
    );
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
    "worklet";
    const r = prepRect;
    return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
  };

  const hitBin = (cx: number, cy: number) => {
    "worklet";
    const rs: BinRect[] = binRects.value;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (
        cx >= r.x - 10 &&
        cx <= r.x + r.w + 10 &&
        cy >= r.y - 10 &&
        cy <= r.y + r.h + 10
      )
        return i;
    }
    return -1;
  };

  const hitSink = (cx: number, cy: number) => {
    "worklet";
    const r = basinRect;
    return (
      cx >= r.x - 8 &&
      cx <= r.x + r.w + 8 &&
      cy >= r.y - 8 &&
      cy <= r.y + r.h + 8
    );
  };

  const bounce = () => {
    "worklet";
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
          runOnJS(onPrep)(itemKey, def, cx, cy);
        } else {
          bounce();
          if (binHit >= 0) runOnJS(onBottleNeedsPrep)();
          else if (sinkHit) runOnJS(onBottleSinkHint)();
        }
        return;
      }
      if (def.needsRinse) {
        if (sinkHit) {
          settled.value = true;
          runOnJS(onSink)(itemKey, def.id, cx, cy);
        } else {
          bounce();
          if (binHit >= 0) runOnJS(onRinseHint)();
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
        else if (sinkHit) runOnJS(onCleanHint)();
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: bx.value + dx.value }, { translateY: dy.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.item, { top: ITEM_Y }, style]}>
        <ItemGlyph def={def} />
        <Text style={styles.itemLabel} numberOfLines={1}>
          {def.name}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

export function BeltScreen({
  regionId,
  title,
  endless,
  onShiftEnd,
  onQuit,
}: {
  regionId: string | string[];
  title: string;
  endless?: boolean;
  onShiftEnd: (r: ShiftResult) => void;
  onQuit: () => void;
}) {
  const [pool, setPool] = useState<GameItem[] | null>(null);
  const [items, setItems] = useState<{ key: number; def: ItemDef }[]>([]);
  const [resolved, setResolved] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lives, setLives] = useState(ENDLESS_LIVES);
  const [hint, setHint] = useState<string | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>(
    [],
  );
  const [runId, setRunId] = useState(0);
  const [modal, setModal] = useState<{
    x: number;
    y: number;
    paused: boolean;
    item: GameItem;
  } | null>(null);
  const [danger, setDanger] = useState(false);
  const [sinkItems, setSinkItems] = useState<SinkItem[]>([]);
  const [userPaused, setUserPaused] = useState(false);
  const quitRef = useRef(false);

  const keyRef = useRef(0);
  const seqRef = useRef(0);
  const streakRef = useRef(0);
  const burstId = useRef(0);
  const queueRef = useRef<ItemDef[]>([]);
  const poolRef = useRef<GameItem[]>([]);
  const lastDrawRef = useRef(-1);
  const dangerKeysRef = useRef<Set<number>>(new Set());
  const twistEncounters = useRef(0);
  const peelEncounters = useRef(0);
  const lessonsRef = useRef(new Map<string, string>());
  const endedRef = useRef(false);
  const seasonRef = useRef<{ def: SeasonDef; items: GameItem[] } | null>(null);
  const sawRareRef = useRef(false);
  const onShiftEndRef = useRef(onShiftEnd);
  onShiftEndRef.current = onShiftEnd;

  const binRects = useSharedValue<BinRect[]>([]);
  const missFlash = useSharedValue(0);
  const scroll = useSharedValue(0);

  // derived, never separate state: paused for learning modals or by the user
  const beltPaused = (modal?.paused ?? false) || userPaused;

  useEffect(() => {
    binRects.value = [0, 1, 2].map((i) => ({
      x: binX(i),
      y: binY,
      w: BIN_W,
      h: BIN_H,
    }));
  }, []);

  // chevron scroll runs unless the user paused (freezes mid-frame, resumes clean)
  useEffect(() => {
    if (userPaused) {
      scroll.value = scroll.value;
    } else {
      scroll.value = withRepeat(
        withTiming(-CHEV_GAP, { duration: 450, easing: Easing.linear }),
        -1,
        false,
      );
    }
  }, [userPaused]);

  // load the region pool (SQLite, JSON fallback) + the seasonal set
  const regionKey = JSON.stringify(regionId);
  useEffect(() => {
    const ids = Array.isArray(regionId) ? regionId : [regionId];
    loadUnionItems(ids).then((p) => {
      poolRef.current = p;
      setPool(p);
    });
    const season = getActiveSeason();
    if (season) {
      loadSeasonalItems(season.id).then((items) => {
        seasonRef.current = { def: season, items };
      });
    } else {
      seasonRef.current = null;
    }
  }, [regionKey]);

  // random draw from the spawnable pool (complex items only once their
  // mechanic exists; the bottle's twist-peel does)
  const drawFromPool = (p: GameItem[]): GameItem => {
    const spawnable = p.filter(
      (it) => !it.complex || it.mechanic === "twist-peel",
    );
    let i = Math.floor(Math.random() * spawnable.length);
    if (i === lastDrawRef.current) i = (i + 1) % spawnable.length;
    lastDrawRef.current = i;
    return spawnable[i];
  };

  // single draw: seasonal roll first (replaces a universal spawn), else pool
  const drawOne = (): GameItem => {
    const s = seasonRef.current;
    if (s && s.items.length > 0 && Math.random() < s.def.replaceRate) {
      const pick = drawSeasonal(s.items, s.def.id);
      if (pick.rarity === "rare") sawRareRef.current = true;
      return pick;
    }
    return drawFromPool(poolRef.current);
  };

  const buildQueue = (p: GameItem[], n: number): GameItem[] => {
    const q: GameItem[] = [];
    const bottle = p.find((it) => it.id === "bottle");
    if (DEBUG_BOTTLE_ONLY && bottle) {
      for (let i = 0; i < n; i++) q.push(bottle);
      return q;
    }
    for (let i = 0; i < n; i++) {
      q.push(bottle && (i === 5 || i === 13) ? bottle : drawOne());
    }
    return q;
  };

  // fresh queue per run, once the pool is loaded
  useEffect(() => {
    if (!pool) return;
    sawRareRef.current = false;
    queueRef.current = buildQueue(pool, SHIFT_ITEMS);
  }, [runId, pool]);

  // spawner (dead while the belt is paused for learning; refills in endless)
  useEffect(() => {
    if (beltPaused || !pool) return;
    const t = setInterval(() => {
      const q = queueRef.current;
      if (q.length === 0) {
        if (endless) {
          q.push(...buildQueue(poolRef.current, 8));
        } else {
          clearInterval(t);
          return;
        }
      }
      const def = q.shift()!;
      const key = ++keyRef.current;
      setItems((prev) => [...prev, { key, def }]);
    }, SPAWN_MS);
    return () => clearInterval(t);
  }, [runId, beltPaused, pool, endless]);

  // shift end (waits out an open modal), reported once to GameRoot
  useEffect(() => {
    if (endedRef.current) return;
    const finished = endless ? lives <= 0 : resolved >= SHIFT_ITEMS;
    if (!finished || modal) return;
    endedRef.current = true;
    const t = setTimeout(() => {
      if (quitRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const accuracy = resolved > 0 ? correct / resolved : 0;
      const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;
      onShiftEndRef.current({
        correct,
        total: resolved,
        missed,
        bestStreak,
        stars,
        lessons: Array.from(lessonsRef.current.values()),
        score: correct,
        sawRare: sawRareRef.current,
      });
    }, 700);
    return () => clearTimeout(t);
  }, [resolved, lives, modal, endless, correct, missed, bestStreak]);

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

  const findDef = (defId: string) =>
    poolRef.current.find((d) => d.id === defId) ??
    seasonRef.current?.items.find((d) => d.id === defId);

  // mistake-as-lesson: first miss per item per shift teaches, repeats just sting
  const wrongSort = (def: GameItem) => {
    const right = BINS.find((b) => b.id === def.bin)!;
    if (def.teaching && !lessonsRef.current.has(def.id)) {
      lessonsRef.current.set(def.id, def.teaching);
      setHint(`Lesson: ${def.teaching} → ${right.label}`);
    } else {
      setHint(`${def.name} → ${right.label}`);
    }
    streakRef.current = 0;
    setStreak(0);
  };

  const handleDrop = (
    key: number,
    defId: string,
    binIdx: number,
    x: number,
    y: number,
  ) => {
    const def = findDef(defId);
    setItems((prev) => prev.filter((i) => i.key !== key));
    clearDanger(key);
    if (!def) {
      setResolved((r) => r + 1);
      return;
    }
    const bin = BINS[binIdx];
    if (bin.id === def.bin) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addBurst(x, y);
      markItemSeen(def.id);
      setCorrect((c) => c + 1);
      streakRef.current += 1;
      setStreak(streakRef.current);
      setBestStreak((b) => Math.max(b, streakRef.current));
      setHint(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      wrongSort(def);
    }
    setResolved((r) => r + 1);
  };

  const handleMissed = (key: number) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    clearDanger(key);
    setMissed((m) => m + 1);
    if (endless) setLives((l) => l - 1);
    streakRef.current = 0;
    setStreak(0);
    setHint("Missed — that contaminates the line");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    flashMiss();
    setResolved((r) => r + 1);
  };

  const handlePrep = (key: number, def: GameItem, x: number, y: number) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    clearDanger(key);
    const paused = twistEncounters.current < 2 || peelEncounters.current < 2;
    twistEncounters.current += 1;
    peelEncounters.current += 1;
    setModal({ x, y, paused, item: def });
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

  // FIFO pump: done -> rack (cap 4, oldest first), then oldest queued -> rinsing
  const pumpSink = (items: SinkItem[]): SinkItem[] => {
    const next = [...items];
    let di = next.findIndex((i) => i.status === "done");
    while (
      di >= 0 &&
      next.filter((i) => i.status === "rack").length < RACK_CAP
    ) {
      next[di] = { ...next[di], status: "rack" };
      di = next.findIndex((i) => i.status === "done");
    }
    if (!next.some((i) => i.status === "rinsing")) {
      const qi = next.findIndex((i) => i.status === "queued");
      if (qi >= 0) next[qi] = { ...next[qi], status: "rinsing" };
    }
    return next;
  };

  const handleSink = (key: number, defId: string, x: number, y: number) => {
    const def = findDef(defId);
    setItems((prev) => prev.filter((i) => i.key !== key));
    clearDanger(key);
    const item: SinkItem = {
      key,
      def,
      seq: seqRef.current++,
      status: "queued",
    };
    setSinkItems((prev) => pumpSink([...prev, item]));
    setHint(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRinseDone = (key: number) => {
    setSinkItems((prev) =>
      pumpSink(
        prev.map((it) =>
          it.key === key ? { ...it, status: "done" as SinkStatus } : it,
        ),
      ),
    );
  };

  const handleRackDrop = (
    key: number,
    defId: string,
    binIdx: number,
    x: number,
    y: number,
  ) => {
    const def = findDef(defId);
    setSinkItems((prev) => pumpSink(prev.filter((it) => it.key !== key)));
    if (!def) {
      setResolved((r) => r + 1);
      return;
    }
    const bin = BINS[binIdx];
    if (bin.id === def.bin) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addBurst(x, y);
      markItemSeen(def.id);
      setCorrect((c) => c + 1);
      streakRef.current += 1;
      setStreak(streakRef.current);
      setBestStreak((b) => Math.max(b, streakRef.current));
      setHint(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      wrongSort(def);
    }
    setResolved((r) => r + 1);
  };

  const doQuit = () => {
    quitRef.current = true;
    onQuit();
  };

  const handleBottleNeedsPrep = () =>
    setHint("Prep the bottle first — drop it in the Prep tray");
  const handlePrepHint = () => setHint("Only bottles need prep");
  const handleRinseHint = () => setHint("Rinse it first — drop it in the sink");
  const handleBottleSinkHint = () => setHint("Bottles go to the Prep tray");
  const handleCleanHint = () => setHint("That one's already clean");

  const chevStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scroll.value }],
  }));
  const missStyle = useAnimatedStyle(() => ({
    opacity: missFlash.value,
  }));

  const waitingOnSink =
    !endless &&
    pool !== null &&
    queueRef.current.length === 0 &&
    items.length === 0 &&
    sinkItems.length > 0;

  const rackItems = sinkItems.filter((i) => i.status === "rack");

  // seasonal reskin v1: cooler backdrop while a season is live
  const seasonActive = !!getActiveSeason();

  if (!pool) {
    return (
      <View style={[styles.root, styles.loadingWrap]}>
        <Text style={styles.loading}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, seasonActive && styles.winterRoot]}>
      {/* HUD */}
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudTitle}>
            {seasonActive ? "❄ " : ""}
            {title}
          </Text>
          <Text style={styles.hudSub}>
            {endless ? `score ${correct}` : `${resolved}/${SHIFT_ITEMS} sorted`}
          </Text>
        </View>
        <View style={styles.streakWrap}>
          <Text style={styles.streak}>
            {endless
              ? "❤".repeat(Math.max(0, lives))
              : streak > 1
                ? `🔥 ×${streak}`
                : " "}
          </Text>
          <Pressable
            onPress={() => setUserPaused(true)}
            hitSlop={10}
            style={styles.pauseBtn}
          >
            <Text style={styles.pauseGlyph}>⏸</Text>
          </Pressable>
        </View>
      </View>
      {(hint || waitingOnSink) && (
        <Text style={styles.hint}>
          {hint ?? "Finish the rinse — drag clean items to their bins"}
        </Text>
      )}

      {/* belt */}
      <View style={[styles.belt, { top: BELT_TOP, height: BELT_H }]}>
        <Animated.View style={[styles.chevStrip, chevStyle]}>
          {Array.from({
            length: Math.ceil((SW + CHEV_GAP * 2) / CHEV_GAP),
          }).map((_, i) => (
            <Text key={i} style={styles.chev}>
              ›
            </Text>
          ))}
        </Animated.View>
        <Animated.View
          style={[styles.missEdge, missStyle]}
          pointerEvents="none"
        />
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
          onDrop={handleDrop}
          onMissed={handleMissed}
          onPrep={handlePrep}
          onDanger={handleDanger}
          onSink={handleSink}
          onBottleNeedsPrep={handleBottleNeedsPrep}
          onPrepHint={handlePrepHint}
          onRinseHint={handleRinseHint}
          onBottleSinkHint={handleBottleSinkHint}
          onCleanHint={handleCleanHint}
        />
      ))}

      {/* prep drop zone */}
      <View
        style={[
          styles.prep,
          { left: PREP.x, top: PREP.y, width: PREP.w, height: PREP.h },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.prepLabel}>PREP</Text>
        <Text style={styles.prepSub}>bottles go here</Text>
      </View>

      {/* rinse sink: big FIFO basin + clean rack on the side (cap 4) */}
      <SinkBasin
        items={sinkItems}
        onRinseDone={handleRinseDone}
        paused={userPaused}
      />
      <Text style={[styles.rackLabel, { left: RACK.x, top: RACK.y + 4 }]}>
        CLEAN
      </Text>
      {[0, 1, 2, 3].map((i) => (
        <RackSlot
          key={i}
          item={rackItems[i] ?? null}
          index={i}
          binRects={binRects}
          onCleanDrop={handleRackDrop}
        />
      ))}

      {/* bins */}
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
          parts={modal.item.parts ?? []}
          onClose={handleModalClose}
        />
      )}

      {/* user pause overlay */}
      {userPaused && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <Text style={styles.pauseTitle}>Paused</Text>
            <Pressable
              onPress={() => setUserPaused(false)}
              style={styles.pauseAction}
            >
              <Text style={styles.pauseActionText}>Resume</Text>
            </Pressable>
            <Pressable
              onPress={doQuit}
              style={[styles.pauseAction, styles.quitAction]}
            >
              <Text style={[styles.pauseActionText, styles.quitText]}>
                Quit shift
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  winterRoot: { backgroundColor: "#EDF1F6" },
  loadingWrap: { justifyContent: "center", alignItems: "center" },
  loading: { fontSize: 17, fontWeight: "700", color: C.sub },
  hud: {
    paddingTop: 64,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hudTitle: { fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: 3 },
  hudSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  streakWrap: { minWidth: 80, alignItems: "flex-end" },
  streak: { fontSize: 20, fontWeight: "800", color: C.ink },
  pauseBtn: {
    marginTop: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFDF8",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pauseGlyph: { fontSize: 18, color: C.sub },
  pauseOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(46,42,38,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  pauseCard: {
    backgroundColor: "#FFFDF8",
    borderRadius: 20,
    padding: 28,
    width: 240,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  pauseTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: C.ink,
    marginBottom: 18,
  },
  pauseAction: {
    backgroundColor: C.belt,
    borderRadius: 14,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  pauseActionText: { fontSize: 17, fontWeight: "800", color: "#FFFDF8" },
  quitAction: { backgroundColor: "#F3E9D8" },
  quitText: { color: C.sub },
  hint: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#B3541E",
    paddingHorizontal: 40,
    minHeight: 20,
  },
  belt: {
    position: "absolute",
    left: 24,
    right: 24,
    backgroundColor: C.belt,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "center",
  },
  chevStrip: {
    position: "absolute",
    left: -CHEV_GAP,
    flexDirection: "row",
    alignItems: "center",
  },
  chev: {
    width: CHEV_GAP,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    color: "rgba(250,243,232,0.28)",
  },
  missEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 26,
    backgroundColor: "#D95F4B",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  item: {
    position: "absolute",
    left: 0,
    width: ITEM_S + 16,
    alignItems: "center",
  },
  itemLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: C.ink,
    backgroundColor: "rgba(250,243,232,0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  prep: {
    position: "absolute",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#B9A88F",
    borderRadius: 16,
    backgroundColor: "rgba(232,161,61,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  prepLabel: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 4,
    color: "#A08C6D",
  },
  prepSub: { fontSize: 11, color: "#A08C6D", marginTop: 2 },
  rackLabel: {
    position: "absolute",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#8FAE8B",
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
  binLabel: {
    position: "absolute",
    bottom: 10,
    color: "#4A3F35",
    fontWeight: "800",
    fontSize: 15,
  },
});
