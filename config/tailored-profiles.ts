import type { ProfileSummary } from "@/lib/schemas/profileSummary";

/**
 * Tailored profile content for specific users. Shown when the user's email
 * (from profile or Clerk) matches. Safe for others to see — just more polished.
 */
const TAILORED: Record<
  string,
  Omit<ProfileSummary, "generatedAt"> & { displayName?: string }
> = {
  "alexanderjoshua@comcast.net": {
    displayName: "Alan Turing",
    headline:
      "Architecting adaptive AI systems with world-class design and long-term vision",
    bio: "Forward-deployed engineer at Arista Networks building a constellation of AI projects under Coalescence Labs. I operate at the intersection of AI orchestration, memory-aware systems, full-stack architecture, and design-forward interfaces — externalizing metacognition into tools that shape how humans interact with AI.",
    tags: [
      "AI orchestration",
      "Memory-aware systems",
      "Agent orchestration",
      "Organic interfaces",
      "Privacy-first",
      "Pastry & espresso",
      "Strength training",
      "Carlo Rovelli reader",
    ],
  },
  "demo@example.com": {
    displayName: "Alan Turing",
    headline: "Product designer & maker exploring AI-native tools",
    bio: "Demo profile for exploring the interface. In a real account, your about me can be AI-generated from your activity or written by you.",
    tags: [
      "Design systems",
      "Prototyping",
      "AI-assisted workflows",
      "User research",
      "Fresh pasta",
      "Seasonal cooking",
    ],
  },
};

/** Email addresses that have tailored profile content. */
export const TAILORED_PROFILE_EMAILS = Object.keys(TAILORED) as string[];

/**
 * Returns a full ProfileSummary for the given email if tailored content exists.
 * Otherwise null.
 */
export function getTailoredProfileSummary(
  email: string | null | undefined,
): ProfileSummary | null {
  if (!email || typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  const content = TAILORED[normalized];
  if (!content) return null;
  return {
    ...content,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Returns the tailored display name for the given email, or null.
 */
export function getTailoredDisplayName(
  email: string | null | undefined,
): string | null {
  if (!email || typeof email !== "string") return null;
  return TAILORED[normalizedEmail(email)]?.displayName ?? null;
}

/**
 * True if this email has tailored profile content.
 */
export function hasTailoredProfile(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return normalizedEmail(email) in TAILORED;
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}
