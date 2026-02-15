import type { ProfileSummary } from "@/lib/schemas/profileSummary";
import {
  getOwnerEmail,
  getOwnerDisplayName,
  getOwnerBio,
} from "./profile-overrides";

/**
 * Tailored profile content for specific users. Shown when the user's email
 * (from profile or Clerk) matches. Safe for others to see — just more polished.
 *
 * The owner entry is keyed by the email from `.local-profile-overrides.ts`
 * (gitignored). When that file is absent, a generic placeholder is used.
 */

type TailoredEntry = Omit<ProfileSummary, "generatedAt"> & { displayName?: string };

function buildTailored(): Record<string, TailoredEntry> {
  const entries: Record<string, TailoredEntry> = {};

  // Owner entry — personal details loaded from gitignored overrides
  entries[getOwnerEmail()] = {
    displayName: getOwnerDisplayName() ?? undefined,
    headline:
      "Architecting adaptive AI systems with world-class design and long-term vision",
    bio: getOwnerBio(),
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
  };

  // Demo entry — entirely generic, no personal data
  entries["demo@example.com"] = {
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
  };

  return entries;
}

let _tailored: Record<string, TailoredEntry> | null = null;
function getTailored(): Record<string, TailoredEntry> {
  if (!_tailored) _tailored = buildTailored();
  return _tailored;
}

/** Email addresses that have tailored profile content. */
export const TAILORED_PROFILE_EMAILS = (() => {
  try {
    return Object.keys(buildTailored());
  } catch {
    return ["demo@example.com"];
  }
})();

/**
 * Returns a full ProfileSummary for the given email if tailored content exists.
 * Otherwise null.
 */
export function getTailoredProfileSummary(
  email: string | null | undefined,
): ProfileSummary | null {
  if (!email || typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  const content = getTailored()[normalized];
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
  return getTailored()[normalizedEmail(email)]?.displayName ?? null;
}

/**
 * True if this email has tailored profile content.
 */
export function hasTailoredProfile(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return normalizedEmail(email) in getTailored();
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}
