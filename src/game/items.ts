/* Phase 2 placeholder content. Real region/item data pipeline lands in phase 5. */

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

export interface ItemDef {
  id: string;
  name: string;
  bin: BinId;
  color: string;
  shape: 'circle' | 'rect' | 'diamond';
}

export const ITEM_DEFS: ItemDef[] = [
  { id: 'banana', name: 'Banana peel', bin: 'compost', color: '#E8C53D', shape: 'circle' },
  { id: 'apple', name: 'Apple core', bin: 'compost', color: '#D95F4B', shape: 'circle' },
  { id: 'coffee', name: 'Coffee grounds', bin: 'compost', color: '#7A5230', shape: 'rect' },
  { id: 'pizza', name: 'Pizza box', bin: 'compost', color: '#D9A05F', shape: 'rect' },
  { id: 'news', name: 'Newspaper', bin: 'recycle', color: '#9AA3A8', shape: 'rect' },
  { id: 'can', name: 'Alu can', bin: 'recycle', color: '#C0CBD2', shape: 'circle' },
  { id: 'jar', name: 'Glass jar', bin: 'recycle', color: '#7FB3D5', shape: 'rect' },
  { id: 'chips', name: 'Chip bag', bin: 'landfill', color: '#E8913D', shape: 'rect' },
  { id: 'styro', name: 'Foam cup', bin: 'landfill', color: '#EDEAE2', shape: 'circle' },
  { id: 'butt', name: 'Cig butt', bin: 'landfill', color: '#8A7B68', shape: 'diamond' },
];

let lastIdx = -1;
/** Draw a random item, avoiding an immediate repeat. */
export function drawItem(): ItemDef {
  let i = Math.floor(Math.random() * ITEM_DEFS.length);
  if (i === lastIdx) i = (i + 1) % ITEM_DEFS.length;
  lastIdx = i;
  return ITEM_DEFS[i];
}
