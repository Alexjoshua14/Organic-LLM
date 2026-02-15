/**
 * Profile summary cache: always localStorage for quick load.
 * Supabase grabbers can be added later to sync.
 */

import {
  ProfileSummarySchema,
  type ProfileSummary,
} from "@/lib/schemas/profileSummary";

const PROFILE_SUMMARY_KEY = "organic-llm-profile-summary";

export function getProfileSummary(): ProfileSummary | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROFILE_SUMMARY_KEY);
  if (!raw) return null;
  try {
    return ProfileSummarySchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setProfileSummary(summary: ProfileSummary): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_SUMMARY_KEY, JSON.stringify(summary));
}

export { PROFILE_SUMMARY_KEY };
