import type { MemorySector, MemoryTouchKind } from "@/lib/memory/mindmap";

export type LaidOutSector = MemorySector & {
  x: number;
  y: number;
  r: number;
  count: number;
};

const VIEW = 200;
const CENTER = VIEW / 2;

function nodeRadius(count: number, maxCount: number): number {
  const t = maxCount <= 1 ? 1 : (count - 1) / (maxCount - 1);

  return 9 + t * 6;
}

/**
 * Even polar layout around the nucleus. Coordinates are in a 200×200 viewBox.
 */
export function layoutMemorySectors(
  sectors: MemorySector[],
  countById?: Record<string, number>
): LaidOutSector[] {
  const n = sectors.length;
  const maxCount = Math.max(1, ...sectors.map((s) => countById?.[s.id] ?? s.memoryIds.length));
  const radius = n > 6 ? 64 : 70;

  return sectors.map((sector, i) => {
    const angle = -Math.PI / 2 + (n === 0 ? 0 : (i / n) * Math.PI * 2);
    const count = countById?.[sector.id] ?? sector.memoryIds.length;

    return {
      ...sector,
      count,
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle),
      r: nodeRadius(Math.max(0, count), maxCount),
    };
  });
}

export function tendrilPath(x: number, y: number, kind?: MemoryTouchKind | "in-context"): string {
  const cx = CENTER;
  const cy = CENTER;
  const mx = (cx + x) / 2;
  const my = (cy + y) / 2;
  const dx = x - cx;
  const dy = y - cy;
  const len = Math.hypot(dx, dy) || 1;
  const bend = kind ? 14 : 10;
  const qx = mx - (dy / len) * bend;
  const qy = my + (dx / len) * bend;

  return `M ${cx} ${cy} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
}

export const MINDMAP_VIEWBOX = `0 0 ${VIEW} ${VIEW}`;
export const MINDMAP_CENTER = CENTER;
