/** Compact plot: 1–5 on a short vertical band so the map reads beside evidence. */
export const plotX = (index: number, count: number) => 28 + (index * 544) / Math.max(1, count - 1);

export const plotY = (value: number) => 140 - (value - 1) * 28;
