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
const DB_VERSION = 1;

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
      parts TEXT
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
  `);
  const row: any = db.getFirstSync('SELECT value FROM meta WHERE key = ?', ['items_version']);
  if (row && row.value === String(DB_VERSION)) return;
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM items');
    for (const it of SEED) {
      db.runSync(
        'INSERT INTO items (id, region, name, bin, color, shape, complex, mechanic, needs_rinse, signature, tricky, teaching, parts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        ],
      );
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
