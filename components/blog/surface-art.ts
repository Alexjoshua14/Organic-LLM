import type { BlogArtId } from "@/lib/blog/posts";

/** Which line drawing each surface wears on its card. Keyed by the surface's URL slug. */
const SURFACE_ART: Record<string, BlogArtId> = {
  chat: "chat",
  arcadia: "arcadia",
  noesis: "noesis",
  strata: "strata",
  "rabbit-holes": "rabbit",
  ergon: "ergon",
  remy: "remy",
};

export function surfaceArt(slug: string): BlogArtId {
  return SURFACE_ART[slug] ?? "surfaces";
}
