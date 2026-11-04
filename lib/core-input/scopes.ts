/**
 * Where a CoreInput snapshot belongs. Resolution walks `key`, then `inheritFrom` in order,
 * then the legacy global composer prefs; the first stored snapshot wins.
 *
 * A user change writes `key` and every `writeThrough` key, so an area remembers the last
 * settings used anywhere inside it and new threads in that area start from them.
 */
export type CoreInputScope = {
  key: string;
  inheritFrom?: readonly string[];
  writeThrough?: readonly string[];
  /**
   * Session-only: changes live in memory until the scope closes, never reach the cache,
   * Supabase, or the legacy prefs. Closing it snaps CoreInput back to the outer scope.
   */
  ephemeral?: boolean;
};

/** An area of Organic with its own CoreInput settings: an experience, persona, or surface. */
export type CoreInputArea = string;

export const coreInputScopes = {
  /** One thread inside an area (e.g. an Arcadia thread). New threads start from the area. */
  thread: (area: CoreInputArea, threadId: string): CoreInputScope => ({
    key: `${area}:thread:${threadId}`,
    inheritFrom: [area],
    writeThrough: [area],
  }),
  /** `/btw` side thread: seeded from the thread it was opened in, forgotten on close. */
  btw: (area: CoreInputArea, threadId: string): CoreInputScope => ({
    key: `btw:${threadId}`,
    inheritFrom: [`${area}:thread:${threadId}`, area],
    ephemeral: true,
  }),
  /** A surface without threads of its own (e.g. Rabbit Holes' prompt bar). */
  area: (area: CoreInputArea): CoreInputScope => ({ key: area }),
} as const;
