import { z } from "zod";

/**
 * Homepage resurfacing: past thoughts brought back as cards under the composer. Client-safe —
 * the homepage reads {@link ResurfaceCard}; the Speak mint reads {@link ResurfaceSeedSchema}.
 */
export const RESURFACE_KINDS = ["memory", "thread", "rabbit_hole", "strata_page"] as const;

export type ResurfaceKind = (typeof RESURFACE_KINDS)[number];

export const RESURFACE_KIND_LABEL: Record<ResurfaceKind, string> = {
  memory: "Memory",
  thread: "Chat",
  rabbit_hole: "Rabbit hole",
  strata_page: "Strata",
};

/** What the homepage renders. The recap and related context stay server-side. */
export type ResurfaceCard = {
  id: string;
  kind: ResurfaceKind;
  title: string;
  /** Where the thought lives. Memories have no page of their own. */
  href: string | null;
};

export type ResurfaceResponse = {
  cards: ResurfaceCard[];
  /** `fallback` when Jev was unavailable and the cards are recency-ordered. */
  source: "jev" | "fallback";
  /** Speak Realtime is switched on for this deployment; hides the voice start when false. */
  voiceEnabled: boolean;
};

/**
 * Sent with the Speak mint. Only the card id travels: the server rebuilds the starter context
 * from its own cache, so the client never supplies the text the model is told.
 */
export const ResurfaceSeedSchema = z.object({
  cardId: z.string().min(1).max(64),
});

export type ResurfaceSeed = z.infer<typeof ResurfaceSeedSchema>;
