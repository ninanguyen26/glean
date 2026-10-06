/* Phase 5: types + stream defs. Item content lives in data/seed/items.json
   and is loaded via src/game/db.ts (SQLite, JSON fallback). */

export type BinId = 'compost' | 'recycle' | 'landfill';

export interface BinDef {
  id: BinId;
  label: string;
  color: string;
}

export const BINS: BinDef[] = [
  { id: 'compost', label: 'Compost', color: '#7BAE6E' },
  { id: 'recycle', label: 'Recycle', color: '#5B9BD5' },
  { id: 'landfill', label: 'Landfill', color: '#9A958C' },
];

export interface PartDef {
  id: string;
  label: string;
  bin: BinId;
  hint: string;
}

export interface GameItem {
  id: string;
  region: string;
  name: string;
  bin: BinId;
  color: string;
  shape: 'circle' | 'rect' | 'diamond';
  complex?: boolean; // needs disassembly in the prep modal
  mechanic?: string; // which disassembly choreography, e.g. 'twist-peel'
  needsRinse?: boolean; // must visit the sink before its bin
  signature?: boolean;
  tricky?: boolean;
  teaching?: string;
  parts?: PartDef[]; // separable parts for complex items
  season?: string; // seasonal event id, e.g. 'winter'
  rarity?: 'common' | 'uncommon' | 'rare';
}

/** Legacy alias used across game code. */
export type ItemDef = GameItem;

export interface RegionDef {
  id: string;
  name: string;
  streams: BinId[];
  workweekDays: number;
  blurb: string;
  unlockStars: number;
  rules: string[];
}
