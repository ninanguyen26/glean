import { GameItem, RegionDef } from './items';

/*
 * Phase 5/6: data pipeline + progression.
 * The seed JSON under data/seed/ is the source of truth; on first launch
 * items are loaded into SQLite (expo-sqlite). Until the dev client is
 * rebuilt with the native module, loaders fall back to the bundled JSON
 * and progress lives in memory (it persists once SQLite is present).
 */

declare const require: any;

const SEED: GameItem[] = require('../../data/seed/items.json').items;
const REGION_SEED: RegionDef[] = require('../../data/seed/regions.json').regions;
const DB_VERSION = 8;

export interface SeasonItemSeed {
  id: string;
  name: string;
  bin: string;
  color: string;
  shape: 'circle' | 'rect' | 'diamond';
  rarity: 'common' | 'uncommon' | 'rare';
  teaching?: string;
  needsRinse?: boolean;
}

export interface SeasonDef {
  id: string;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  replaceRate: number;
  items: SeasonItemSeed[];
}

const SEASON_SEED: SeasonDef[] = require('../../data/seed/seasons.json').seasons;

export const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

export function getAllRegions(): RegionDef[] {
  return REGION_SEED;
}

export function getRegionDef(id: string): RegionDef {
  return REGION_SEED.find((r) => r.id === id)!;
}

function openDb(): any | null {
  try {
    const SQLite = require('expo-sqlite');
    return SQLite.openDatabaseSync('glean.db');
  } catch {
    return null; // native module not installed yet -> JSON/memory fallback
  }
}

function ensureSeeded(db: any) {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      region TEXT NOT NULL,
      name TEXT NOT NULL,
      bin TEXT NOT NULL,
      color TEXT NOT NULL,
      shape TEXT NOT NULL,
      complex INTEGER NOT NULL DEFAULT 0,
      mechanic TEXT,
      needs_rinse INTEGER NOT NULL DEFAULT 0,
      signature INTEGER NOT NULL DEFAULT 0,
      tricky INTEGER NOT NULL DEFAULT 0,
      teaching TEXT,
      parts TEXT,
      season TEXT,
      rarity TEXT
    );
    CREATE TABLE IF NOT EXISTS shift_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city TEXT NOT NULL,
      day INTEGER NOT NULL,
      stars INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      total INTEGER NOT NULL,
      ts INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seen_items (item_id TEXT PRIMARY KEY, ts INTEGER);
    CREATE TABLE IF NOT EXISTS item_sort_counts (item_id TEXT PRIMARY KEY, sorts INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS player_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      cash INTEGER NOT NULL DEFAULT 0,
      xp INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO player_profile (id, cash, xp) VALUES (1, 0, 0);
  `);
  // migrate v1 tables that lack the seasonal columns
  const cols: any[] = db.getAllSync('PRAGMA table_info(items)');
  if (!cols.some((c) => c.name === 'season')) {
    db.execSync('ALTER TABLE items ADD COLUMN season TEXT');
    db.execSync('ALTER TABLE items ADD COLUMN rarity TEXT');
  }
  const row: any = db.getFirstSync('SELECT value FROM meta WHERE key = ?', ['items_version']);
  // 'found' used to mean spawned; now it means sorted correctly — wipe once
  const seenFlag: any = db.getFirstSync('SELECT value FROM meta WHERE key = ?', ['seen_version']);
  if (!seenFlag) {
    db.runSync('DELETE FROM seen_items');
    db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['seen_version', '2']);
  }
  if (row && row.value === String(DB_VERSION)) return;
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM items');
    for (const it of SEED) {
      db.runSync(
        'INSERT INTO items (id, region, name, bin, color, shape, complex, mechanic, needs_rinse, signature, tricky, teaching, parts, season, rarity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          it.id,
          it.region,
          it.name,
          it.bin,
          it.color,
          it.shape,
          it.complex ? 1 : 0,
          it.mechanic ?? null,
          it.needsRinse ? 1 : 0,
          it.signature ? 1 : 0,
          it.tricky ? 1 : 0,
          it.teaching ?? null,
          it.parts ? JSON.stringify(it.parts) : null,
          it.season ?? null,
          it.rarity ?? null,
        ],
      );
    }
    for (const s of SEASON_SEED) {
      for (const it of s.items) {
        db.runSync(
          'INSERT OR REPLACE INTO items (id, region, name, bin, color, shape, season, rarity, teaching, needs_rinse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [it.id, 'seasonal', it.name, it.bin, it.color, it.shape, s.id, it.rarity, it.teaching ?? null, it.needsRinse ? 1 : 0],
        );
      }
    }
    db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [
      'items_version',
      String(DB_VERSION),
    ]);
  });
}

function rowToItem(r: any): GameItem {
  return {
    id: r.id,
    region: r.region,
    name: r.name,
    bin: r.bin,
    color: r.color,
    shape: r.shape,
    complex: !!r.complex,
    mechanic: r.mechanic ?? undefined,
    needsRinse: !!r.needs_rinse,
    signature: !!r.signature,
    tricky: !!r.tricky,
    teaching: r.teaching ?? undefined,
    parts: r.parts ? JSON.parse(r.parts) : undefined,
    season: r.season ?? undefined,
    rarity: r.rarity ?? undefined,
  };
}

/** Universal + one region's items, from SQLite when available, else bundled JSON. */
export async function loadRegionItems(regionId: string): Promise<GameItem[]> {
  return loadUnionItems([regionId]);
}

/** Universal + several regions' items (used by endless mode). */
export async function loadUnionItems(regionIds: string[]): Promise<GameItem[]> {
  const db = openDb();
  if (!db) {
    return SEED.filter((it) => it.region === 'universal' || regionIds.includes(it.region));
  }
  ensureSeeded(db);
  const placeholders = regionIds.map(() => '?').join(',');
  const rows: any[] = db.getAllSync(
    `SELECT * FROM items WHERE region = 'universal' OR region IN (${placeholders})`,
    regionIds,
  );
  return rows.map(rowToItem);
}

/* ---------------- progression ---------------- */

interface ShiftRow {
  city: string;
  day: number;
  stars: number;
  correct: number;
  total: number;
  ts: number;
}

// in-memory fallback until the native SQLite module is present
const memShifts: ShiftRow[] = [];
let memEndlessBest = 0;

function readShifts(): ShiftRow[] {
  const db = openDb();
  if (!db) return memShifts;
  ensureSeeded(db);
  return db.getAllSync('SELECT city, day, stars, correct, total, ts FROM shift_results') as ShiftRow[];
}

export function recordShiftResult(city: string, day: number, stars: number, correct: number, total: number) {
  const db = openDb();
  const row: ShiftRow = { city, day, stars, correct, total, ts: Date.now() };
  if (!db) {
    memShifts.push(row);
    return;
  }
  ensureSeeded(db);
  db.runSync('INSERT INTO shift_results (city, day, stars, correct, total, ts) VALUES (?, ?, ?, ?, ?, ?)', [
    city,
    day,
    stars,
    correct,
    total,
    row.ts,
  ]);
}

/** Best stars per day (1..5) for a city; missing days are 0. */
export function getCityDayBest(city: string): number[] {
  const best = [0, 0, 0, 0, 0];
  for (const r of readShifts()) {
    if (r.city === city && r.day >= 1 && r.day <= 5) {
      best[r.day - 1] = Math.max(best[r.day - 1], r.stars);
    }
  }
  return best;
}

export function getCityStars(city: string): number {
  return getCityDayBest(city).reduce((a, b) => a + b, 0);
}

export function getDaysDone(city: string): number {
  return getCityDayBest(city).filter((s) => s > 0).length;
}

export function getTotalStars(): number {
  return REGION_SEED.reduce((a, r) => a + getCityStars(r.id), 0);
}

export function isRegionUnlocked(regionId: string): boolean {
  const def = getRegionDef(regionId);
  return getTotalStars() >= def.unlockStars;
}

export function isEndlessUnlocked(): boolean {
  return getDaysDone('portland') >= 5;
}

export function getEndlessBest(): number {
  const db = openDb();
  if (!db) return memEndlessBest;
  ensureSeeded(db);
  const row: any = db.getFirstSync('SELECT value FROM meta WHERE key = ?', ['endless_best']);
  return row ? parseInt(row.value, 10) : 0;
}

/** Returns true when it's a new best. */
export function recordEndlessBest(score: number): boolean {
  const db = openDb();
  if (!db) {
    if (score > memEndlessBest) {
      memEndlessBest = score;
      return true;
    }
    return false;
  }
  ensureSeeded(db);
  const prev = getEndlessBest();
  if (score > prev) {
    db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['endless_best', String(score)]);
    return true;
  }
  return false;
}

export interface ProgressSnapshot {
  totalStars: number;
  endlessUnlocked: boolean;
  endlessBest: number;
  cities: {
    id: string;
    stars: number;
    dayBest: number[];
    daysDone: number;
    unlocked: boolean;
    nextDay: number; // 1..5, the day to play next
  }[];
}

export function loadProgress(): ProgressSnapshot {
  return {
    totalStars: getTotalStars(),
    endlessUnlocked: isEndlessUnlocked(),
    endlessBest: getEndlessBest(),
    cities: REGION_SEED.map((r) => ({
      id: r.id,
      stars: getCityStars(r.id),
      dayBest: getCityDayBest(r.id),
      daysDone: getDaysDone(r.id),
      unlocked: isRegionUnlocked(r.id),
      nextDay: Math.min(getDaysDone(r.id) + 1, 5),
    })),
  };
}

/* ---------------- seasonal ---------------- */

export function getActiveSeason(now = new Date()): SeasonDef | null {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const md = m * 100 + d;
  for (const s of SEASON_SEED) {
    const start = s.startMonth * 100 + s.startDay;
    const end = s.endMonth * 100 + s.endDay;
    if (start <= end) {
      if (md >= start && md <= end) return s;
    } else {
      // wraps the year (e.g. winter Dec-Feb)
      if (md >= start || md <= end) return s;
    }
  }
  return null;
}

export function getAllSeasons(): SeasonDef[] {
  return SEASON_SEED;
}

/** Universal items (COMMON album tab), from the bundled seed. */
export function getUniversalItems(): GameItem[] {
  return SEED.filter((it) => it.region === 'universal');
}

/** One city's items (SPECIAL album tab), from the bundled seed. */
export function getCityItems(regionId: string): GameItem[] {
  return SEED.filter((it) => it.region === regionId);
}

export async function loadSeasonalItems(seasonId: string): Promise<GameItem[]> {
  const db = openDb();
  if (db) {
    try {
      ensureSeeded(db);
      const rows: any[] = db.getAllSync('SELECT * FROM items WHERE season = ?', [seasonId]);
      if (rows.length > 0) return rows.map(rowToItem);
    } catch {
      // fall through to the bundled seed
    }
  }
  const s = SEASON_SEED.find((x) => x.id === seasonId);
  return (s?.items ?? []).map((it) => ({ ...it, region: 'seasonal', season: seasonId } as GameItem));
}

// in-memory fallbacks until the native SQLite module is present
const memSeen = new Set<string>();
const memSortCounts: Record<string, number> = {};
const memPity: Record<string, number> = {};

export function markItemSeen(itemId: string) {
  const db = openDb();
  if (!db) {
    memSeen.add(itemId);
    return;
  }
  ensureSeeded(db);
  db.runSync('INSERT OR IGNORE INTO seen_items (item_id, ts) VALUES (?, ?)', [itemId, Date.now()]);
}

export function getSeenItemIds(): string[] {
  const db = openDb();
  if (!db) return [...memSeen];
  ensureSeeded(db);
  return (db.getAllSync('SELECT item_id FROM seen_items') as any[]).map((r) => r.item_id);
}

/** Per-item correct-sort count, for the album's field-guide modal. */
export function incrementSortCount(itemId: string) {
  const db = openDb();
  if (!db) {
    memSortCounts[itemId] = (memSortCounts[itemId] ?? 0) + 1;
    return;
  }
  ensureSeeded(db);
  db.runSync(
    'INSERT INTO item_sort_counts (item_id, sorts) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET sorts = sorts + 1',
    [itemId],
  );
}

/** Correct-sort count for one item (0 when never sorted). */
export function getSortCount(itemId: string): number {
  const db = openDb();
  if (!db) return memSortCounts[itemId] ?? 0;
  ensureSeeded(db);
  const row: any = db.getFirstSync('SELECT sorts FROM item_sort_counts WHERE item_id = ?', [itemId]);
  return row ? row.sorts : 0;
}

const pityKey = (seasonId: string) => `pity_${seasonId}`;

function readPity(db: any, seasonId: string): number {
  const row: any = db.getFirstSync('SELECT value FROM meta WHERE key = ?', [pityKey(seasonId)]);
  return row ? parseInt(row.value, 10) : 0;
}

export function getRarePity(seasonId: string): number {
  const db = openDb();
  if (!db) return memPity[seasonId] ?? 0;
  ensureSeeded(db);
  return readPity(db, seasonId);
}

export function resetRarePity(seasonId: string) {
  const db = openDb();
  if (!db) {
    memPity[seasonId] = 0;
    return;
  }
  ensureSeeded(db);
  db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [pityKey(seasonId), '0']);
}

/** Call at shift end when no rare seasonal appeared. */
export function bumpRarePity(seasonId: string) {
  const db = openDb();
  if (!db) {
    memPity[seasonId] = (memPity[seasonId] ?? 0) + 1;
    return;
  }
  ensureSeeded(db);
  const n = readPity(db, seasonId) + 1;
  db.runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [pityKey(seasonId), String(n)]);
}

/** Rarity-weighted seasonal draw (60/30/10 base, soft pity boosts rares). */
export function drawSeasonal(items: GameItem[], seasonId: string): GameItem {
  const pity = getRarePity(seasonId);
  const rareW = Math.min(0.1 + pity * 0.07, 0.31);
  const rares = items.filter((i) => i.rarity === 'rare');
  const uncommons = items.filter((i) => i.rarity === 'uncommon');
  const commons = items.filter((i) => i.rarity === 'common');
  const r = Math.random();
  let pool: GameItem[];
  if (r < rareW && rares.length > 0) pool = rares;
  else if (r < rareW + (1 - rareW) / 3 && uncommons.length > 0) pool = uncommons;
  else pool = commons.length > 0 ? commons : items;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (pick.rarity === 'rare') resetRarePity(seasonId);
  return pick;
}

/* ---------------- player progression ---------------- */

const memProfile = { cash: 0, xp: 0 };

export function getCash(): number {
  const db = openDb();
  if (!db) return memProfile.cash;
  ensureSeeded(db);
  const row: any = db.getFirstSync('SELECT cash FROM player_profile WHERE id = 1');
  return row ? row.cash : 0;
}

export function getXP(): number {
  const db = openDb();
  if (!db) return memProfile.xp;
  ensureSeeded(db);
  const row: any = db.getFirstSync('SELECT xp FROM player_profile WHERE id = 1');
  return row ? row.xp : 0;
}

/** Level from cumulative XP: flat 1000 XP per level (L1 0-999, L2 1000-1999, ...). */
export function getLevel(xp?: number): number {
  const total = xp ?? getXP();
  return Math.floor(total / 1000) + 1;
}

export function addCash(n: number): number {
  const db = openDb();
  if (!db) {
    memProfile.cash += n;
    return memProfile.cash;
  }
  ensureSeeded(db);
  db.runSync('UPDATE player_profile SET cash = cash + ? WHERE id = 1', [n]);
  return getCash();
}

export function addXP(n: number): { xp: number; level: number; leveledUp: boolean } {
  const oldLevel = getLevel();
  const db = openDb();
  if (!db) {
    memProfile.xp += n;
  } else {
    ensureSeeded(db);
    db.runSync('UPDATE player_profile SET xp = xp + ? WHERE id = 1', [n]);
  }
  const xp = getXP();
  const level = getLevel(xp);
  return { xp, level, leveledUp: level > oldLevel };
}

/** Stars from accuracy: 90%+ = 3, 70%+ = 2, 50%+ = 1, else 0. */
export function starsForAccuracy(correct: number, total: number): number {
  if (total === 0) return 0;
  const acc = correct / total;
  if (acc >= 0.9) return 3;
  if (acc >= 0.7) return 2;
  if (acc >= 0.5) return 1;
  return 0;
}
