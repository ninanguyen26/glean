/* Shared bin hit-test: finger release point, slop, nearest-center wins ties. */

export interface BinRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function hitBinPoint(binRects: { value: BinRect[] }, cx: number, cy: number): number {
  'worklet';
  const rs = binRects.value;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    const s = 24;
    if (cx >= r.x - s && cx <= r.x + r.w + s && cy >= r.y - s && cy <= r.y + r.h + s) {
      const dx = cx - (r.x + r.w / 2);
      const dy = cy - (r.y + r.h / 2);
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
}
