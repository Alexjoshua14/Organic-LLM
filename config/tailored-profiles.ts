import type { ProfileSummary } from "@/lib/schemas/profileSummary";

/**
 * Tailored profile content for specific users. Shown when the user's email
 * (from profile or Clerk) matches. Safe for others to see — just more polished.
 */
const TAILORED: Record<string, Omit<ProfileSummary, "generatedAt">> = {
  "alexanderjoshua@comcast.net": {
    headline: "Architecting adaptive AI systems with world-class design and long-term vision",
    bio: "Software engineer and creative technologist building a cohesive AI ecosystem under Coalescence Labs. I design full-stack, privacy-conscious systems that blend rigorous engineering with refined, organic interfaces. My work spans AI orchestration, memory-aware systems, and immersive UI/UX—aimed at shaping tools that elevate thinking, learning, and human potential.",
    tags: [
      "AI orchestration",
      "Full-stack systems",
      "Memory-aware AI",
      "Organic interfaces",
      "Human-centered design",
      "Next.js & Supabase",
      "Privacy-first infrastructure",
      "Future-ready engineering",
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
 * True if this email has tailored profile content.
 */
export function hasTailoredProfile(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return normalizedEmail(email) in TAILORED;
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}
