import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { playCorrect, playSinkDrop, playWrong } from "../audio/sounds";
import { palette } from "../constants/theme";
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
import { BinRect } from "./binHit";
import { CoffeeCupModal } from "./CoffeeCupModal";
import {
  addCash,
  drawSeasonal,
  getActiveSeason,
  getCash,
  getTotalStars,
  incrementSortCount,
  loadSeasonalItems,
  loadUnionItems,
  markItemSeen,
  SeasonDef,
  starsForAccuracy,
} from "./db";
import { DisassemblyModal } from "./DisassemblyModal";
import { ItemGlyph } from "./ItemGlyph";
import { BINS, GameItem, ItemDef } from "./items";
import { LifetimeHud } from "./LifetimeHud";
import {
  basinRect,
  RACK_CAP,
  RackSlot,
  SINK_RECT,
  SinkBasin,
  SinkItem,
  SinkStatus,
  TRAY_RECT,
} from "./SinkView";
import {
  BELT_BG,
  BIN_SPRITES,
  ICON_AUTUMN,
  ICON_PAUSE,
  ICON_QUIT,
  ICON_RESUME,
  ICON_SPRING,
  ICON_STREAK,
  ICON_SUMMER,
  ICON_WINTER,
} from "./sprites";
import { spriteTuningFor } from "./spriteSizes";

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
  cashEarned: number;
  streakBonus: number;
  cashBefore: number;
  starsBefore: number;
  sawRare: boolean;
  newBest?: boolean;
}

const BELT_TOP = 220;
const BELT_H = 320;
const ITEM_S = 80;
const ITEM_Y = BELT_TOP + (BELT_H - ITEM_S) / 2;
const SPAWN_X = SW + 40;
const MISS_X = -ITEM_S - 24;
const DANGER_X = 70;
const SPEED = 110; // pt/s
const SPAWN_MS = 2600;
const SHIFT_ITEMS = 20;
const CHEV_GAP = 44;
const ENDLESS_LIVES = 3;

// DEBUG: spawn only Portland items (skip the full game loop when testing Portland)
const DEBUG_PORTLAND_ONLY = true;

// work area: sink top-left, a row of 4 rack slots below it, prep tray
// right (3:4); the tray doubles as the bottle prep drop zone
const PREP = {
  x: TRAY_RECT.x,
  y: TRAY_RECT.y,
  w: TRAY_RECT.w,
  h: TRAY_RECT.h,
};

// absolute-fill style for a zone rect
const zoneStyle = (r: { x: number; y: number; w: number; h: number }) => ({
  position: "absolute" as const,
  left: r.x,
  top: r.y,
  width: r.w,
  height: r.h,
});

const SINK_IMG = require("../../assets/extra/sink.png");
const SINK_ON_IMG = require("../../assets/extra/sink-on.png");
const TRAY_IMG = require("../../assets/extra/prep-tray.png");
const TABLE_IMG = require("../../assets/extra/table.png");
const PORTLAND_BG = require("../../assets/background/portland-bg.png");

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

  const tuning = spriteTuningFor(def.id);
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.item,
          { top: ITEM_Y + tuning.dy, left: tuning.dx },
          style,
        ]}
      >
        <ItemGlyph def={def} size={tuning.size} />
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
  const streakMilestonesRef = useRef<Set<number>>(new Set());

  const keyRef = useRef(0);
  const seqRef = useRef(0);
  const streakRef = useRef(0);
  const burstId = useRef(0);
  const queueRef = useRef<ItemDef[]>([]);
  const poolRef = useRef<GameItem[]>([]);
  const lastDrawRef = useRef(-1);
  const dangerKeysRef = useRef<Set<number>>(new Set());
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
  // belt texture scroll + rumble for mechanical feel
  const beltTex = useSharedValue(0);
  const beltRumble = useSharedValue(0);
  useEffect(() => {
    if (userPaused) {
      scroll.value = scroll.value;
      beltTex.value = beltTex.value;
      beltRumble.value = beltRumble.value;
    } else {
      scroll.value = withRepeat(
        withTiming(-CHEV_GAP, { duration: 450, easing: Easing.linear }),
        -1,
        false,
      );
      // texture scroll: one screen width per loop, synced to item speed
      beltTex.value = withRepeat(
        withTiming(-SW, {
          duration: (SW / SPEED) * 1000,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
      // subtle vertical rumble
      beltRumble.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 180 }),
          withTiming(-1, { duration: 180 }),
        ),
        -1,
        true,
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
  // mechanic exists; the bottle's twist-peel and the cup's lid-sleeve do)
  const drawFromPool = (p: GameItem[]): GameItem => {
    const spawnable = p.filter(
      (it) =>
        !it.complex ||
        it.mechanic === "twist-peel" ||
        it.mechanic === "lid-sleeve",
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
    const portland = p.filter((it) => it.region === "portland");
    if (DEBUG_PORTLAND_ONLY && portland.length > 0) {
      for (let i = 0; i < n; i++) q.push(portland[i % portland.length]);
      return q;
    }
    const bottle = p.find((it) => it.id === "bottle");
    for (let i = 0; i < n; i++) {
      q.push(bottle && (i === 5 || i === 13) ? bottle : drawOne());
    }
    return q;
  };

  // fresh queue per run, once the pool is loaded (also rebuilds live when
  // the debug flag is toggled, so you don't need a new shift to test it)
  useEffect(() => {
    if (!pool) return;
    sawRareRef.current = false;
    streakMilestonesRef.current = new Set();
    queueRef.current = buildQueue(pool, SHIFT_ITEMS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, pool, DEBUG_PORTLAND_ONLY]);

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
      const stars = starsForAccuracy(correct, resolved);
      // pre-shift totals for the summary reward flight (db not yet updated)
      const cashBefore = getCash();
      const starsBefore = getTotalStars();
      // cash: $20 base (50%+ accuracy only) + $2/correct + streak bonuses
      const baseCash = accuracy >= 0.5 ? 20 : 0;
      const sortCash = correct * 2;
      const milestones = streakMilestonesRef.current;
      let streakCash = 0;
      if (milestones.has(5)) {
        streakCash += 5;
      }
      if (milestones.has(10)) {
        streakCash += 8;
      }
      if (milestones.has(15)) {
        streakCash += 10;
      }
      if (milestones.has(20)) {
        streakCash += 15;
      }
      const totalCash = baseCash + sortCash + streakCash;
      const newCash = addCash(totalCash);
      onShiftEndRef.current({
        correct,
        total: resolved,
        missed,
        bestStreak,
        stars,
        lessons: Array.from(lessonsRef.current.values()),
        score: correct,
        sawRare: sawRareRef.current,
        cashEarned: totalCash,
        streakBonus: streakCash,
        cashBefore,
        starsBefore,
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
      setHint(`💡 ${def.teaching} → ${right.label}`);
    } else {
      setHint(`${def.name} → ${right.label}`);
    }
    streakRef.current = 0;
    setStreak(0);
  };

  const bumpStreak = () => {
    streakRef.current += 1;
    const s = streakRef.current;
    setStreak(s);
    setBestStreak((b) => Math.max(b, s));
    for (const m of [5, 10, 15, 20]) {
      if (s >= m) streakMilestonesRef.current.add(m);
    }
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
      playCorrect();
      addBurst(x, y);
      markItemSeen(def.id);
      incrementSortCount(def.id);
      setCorrect((c) => c + 1);
      bumpStreak();
      setHint(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      playWrong();
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
    const paused = !endless;
    setModal({ x, y, paused, item: def });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleModalClose = (allCorrect: boolean) => {
    const m = modal;
    if (!m) return;
    setModal(null);
    if (allCorrect) {
      if (m) {
        markItemSeen(m.item.id);
        incrementSortCount(m.item.id);
      }
      setCorrect((c) => c + 1);
      bumpStreak();
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
    playSinkDrop();
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
      playCorrect();
      addBurst(x, y);
      markItemSeen(def.id);
      incrementSortCount(def.id);
      setCorrect((c) => c + 1);
      bumpStreak();
      setHint(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      playWrong();
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
  const beltTexStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: beltTex.value }],
  }));
  const beltRumbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: beltRumble.value }],
  }));

  const waitingOnSink =
    !endless &&
    pool !== null &&
    queueRef.current.length === 0 &&
    items.length === 0 &&
    sinkItems.length > 0;

  const rackItems = sinkItems.filter((i) => i.status === "rack");

  // seasonal reskin v1: cooler backdrop while a season is live
  const activeSeason = getActiveSeason();
  const seasonActive = !!activeSeason;
  const SEASON_ICONS: Record<string, any> = {
    spring: ICON_SPRING,
    summer: ICON_SUMMER,
    fall: ICON_AUTUMN,
    winter: ICON_WINTER,
  };
  const seasonIcon = activeSeason ? SEASON_ICONS[activeSeason.id] : null;

  // Portland gets its own background
  const isPortland = (Array.isArray(regionId) ? regionId : [regionId]).includes(
    "portland",
  );

  // title is "Day N" (global shift count) or "ENDLESS" — rendered as-is

  if (!pool) {
    return (
      <View style={[styles.root, styles.loadingWrap]}>
        <Text style={styles.loading}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, seasonActive && styles.winterRoot]}>
      {/* Portland background (lowest layer) */}
      {isPortland && (
        <ImageBackground
          source={PORTLAND_BG}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          resizeMode="cover"
        />
      )}
      {/* top row: lifetime numbers + pause */}
      <View style={styles.topRow}>
        <View style={styles.lifetimeHud}>
          <LifetimeHud />
        </View>
        <Pressable
          onPress={() => setUserPaused(true)}
          hitSlop={10}
          style={styles.pauseBtn}
        >
          <Image
            source={ICON_PAUSE}
            style={styles.pauseIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>
      {/* shift HUD (bottom block) */}
      <View style={styles.shiftBlock}>
        <View style={[styles.paperPill, styles.titlePill]}>
          {seasonIcon && (
            <Image
              source={seasonIcon}
              style={styles.seasonIcon}
              resizeMode="contain"
            />
          )}
          <Text
            style={styles.shiftTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {title}
          </Text>
        </View>
        <View style={[styles.paperPill, styles.statPill, styles.sortedPill]}>
          <Text style={styles.statText} numberOfLines={1} adjustsFontSizeToFit>
            {endless ? (
              <>
                <Text style={styles.statLabel}>score </Text>
                {correct}
              </>
            ) : (
              <>
                {resolved}/{SHIFT_ITEMS}
                <Text style={styles.statLabel}> items</Text>
              </>
            )}
          </Text>
        </View>
        <View style={[styles.paperPill, styles.statPill, styles.streakPill]}>
          {endless ? (
            <Text style={styles.statText} numberOfLines={1}>
              {"❤".repeat(Math.max(0, lives))}
            </Text>
          ) : (
            <>
              <Image
                source={ICON_STREAK}
                style={styles.streakIcon}
                resizeMode="contain"
              />
              <Text style={styles.statText}>×{streak}</Text>
            </>
          )}
        </View>
      </View>
      {(hint || waitingOnSink) && (
        <Animated.View
          entering={FadeIn.duration(200).springify()}
          style={styles.hintWrap}
        >
          <Text style={styles.hint} numberOfLines={4} adjustsFontSizeToFit>
            {hint ?? "Finish the rinse — drag clean items to their bins"}
          </Text>
        </Animated.View>
      )}

      {/* table texture below the belt's visual bottom (belt.png has transparent padding; visual content ends at ~462pt) */}
      <Image
        source={TABLE_IMG}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 440,
          bottom: 0,
        }}
        resizeMode="cover"
      />
      {/* belt: single texture + rumble */}
      <Animated.View
        style={[
          styles.belt,
          { top: BELT_TOP, height: BELT_H },
          beltRumbleStyle,
        ]}
      >
        <Image
          source={BELT_BG}
          style={{ width: SW, height: BELT_H }}
          resizeMode="stretch"
        />
      </Animated.View>
      {/* danger flash: sibling with explicit belt height */}
      <Animated.View
        style={[
          styles.missEdge,
          { top: BELT_TOP + (BELT_H - 87) / 2, height: 102 },
          missStyle,
        ]}
        pointerEvents="none"
      />

      {/* work area art backdrops (sink + prep tray) */}
      <Image
        source={sinkItems.length > 0 ? SINK_ON_IMG : SINK_IMG}
        style={[zoneStyle(SINK_RECT), styles.artShadow]}
        resizeMode="contain"
      />
      <Image
        source={TRAY_IMG}
        style={[zoneStyle(TRAY_RECT), styles.artShadow]}
        resizeMode="contain"
      />

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

      {/* rinse sink renders on the sink section */}
      <SinkBasin
        items={sinkItems}
        onRinseDone={handleRinseDone}
        paused={userPaused}
      />

      {/* rack slots render on the drying-rack section */}
      {Array.from({ length: RACK_CAP }).map((_, i) => (
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
              style={[{ width: BIN_W, height: BIN_H }, styles.artShadow]}
              resizeMode="contain"
            />
          </View>
        ))}
      </View>

      {/* bursts */}
      {bursts.map((bb) => (
        <Burst key={bb.id} x={bb.x} y={bb.y} />
      ))}

      {/* disassembly modal (coffee cup gets its own lid-sleeve modal) */}
      {modal &&
        (modal.item.mechanic === "lid-sleeve" ? (
          <CoffeeCupModal
            origin={{ x: modal.x, y: modal.y }}
            paused={modal.paused}
            ticker={queueRef.current.slice(0, 3)}
            danger={danger}
            parts={modal.item.parts ?? []}
            itemId={modal.item.id}
            onClose={handleModalClose}
          />
        ) : (
          <DisassemblyModal
            origin={{ x: modal.x, y: modal.y }}
            paused={modal.paused}
            ticker={queueRef.current.slice(0, 3)}
            danger={danger}
            parts={modal.item.parts ?? []}
            itemId={modal.item.id}
            onClose={handleModalClose}
          />
        ))}

      {/* user pause overlay */}
      {userPaused && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <Pressable
              onPress={() => setUserPaused(false)}
              style={styles.pauseButton}
            >
              <Image
                source={ICON_RESUME}
                style={styles.pauseButtonImg}
                resizeMode="contain"
              />
            </Pressable>
            <Pressable onPress={doQuit} style={styles.pauseButton}>
              <Image
                source={ICON_QUIT}
                style={styles.pauseButtonImg}
                resizeMode="contain"
              />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 60, paddingHorizontal: 32 },
  artShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  winterRoot: { backgroundColor: "#EDF1F6" },
  loadingWrap: { justifyContent: "center", alignItems: "center" },
  loading: { fontSize: 17, fontWeight: "700", color: C.sub },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  lifetimeHud: {
    height: 36,
    justifyContent: "center",
  },
  pauseBtn: {
    padding: 4,
  },
  pauseIcon: { width: 42, height: 42 },
  shiftBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  paperPill: {
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: palette.bark,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  titlePill: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
  },
  seasonIcon: { width: 21, height: 21, marginRight: 8 },
  shiftTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.bark,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
  },
  sortedPill: {
    width: 112,
    marginLeft: "auto",
  },
  streakPill: {
    width: 80,
  },
  statText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.bark,
  },
  statLabel: {
    fontWeight: "600",
  },
  streakIcon: { width: 20, height: 20, marginRight: 6 },
  pauseOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -90,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  pauseCard: {
    borderRadius: 20,
    width: 240,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  pauseButton: {
    marginTop: 1,
  },
  pauseButtonImg: {
    width: 180,
    height: 180,
  },
  hintWrap: {
    position: "absolute",
    top: 185,
    left: 115,
    right: 115,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(74, 63, 53, 0.65)",
    borderRadius: 5,
    paddingHorizontal: 16,
  },
  hint: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
  belt: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "transparent",
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
    width: 26,
    backgroundColor: "#D95F4B",
  },
  item: {
    position: "absolute",
    left: 0,
    width: ITEM_S + 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
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
