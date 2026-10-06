import { GameItem } from './items';

/*
 * Phase 5: data pipeline. The seed JSON under data/seed/ is the source of
 * truth; on first launch it is loaded into SQLite (expo-sqlite). Until the
 * dev client is rebuilt with the native module, the loader falls back to
 * reading the bundled JSON directly, so the game stays playable.
 */

declare const require: any;

const SEED: GameItem[] = require('../../data/seed/items.json').items;
const DB_VERSION = 1;

function openDb(): any | null {
  try {
    const SQLite = require('expo-sqlite');
    return SQLite.openDatabaseSync('glean.db');
  } catch {
    return null; // native module not installed yet -> JSON fallback below
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

/** Universal + region items, from SQLite when available, else bundled JSON. */
export async function loadRegionItems(regionId: string): Promise<GameItem[]> {
  const db = openDb();
  if (!db) {
    return SEED.filter((it) => it.region === 'universal' || it.region === regionId);
  }
  ensureSeeded(db);
  const rows: any[] = db.getAllSync('SELECT * FROM items WHERE region = ? OR region = ?', [
    'universal',
    regionId,
  ]);
  return rows.map(rowToItem);
}
