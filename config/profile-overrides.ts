/**
 * Loads personal profile overrides from the gitignored `.local-profile-overrides.ts`.
 * Falls back to safe generic defaults when the file doesn't exist (e.g. CI, other devs).
 *
 * This file IS committed — it just re-exports with safe fallbacks.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

interface ProfileOverrides {
  OWNER_EMAIL: string;
  OWNER_DISPLAY_NAME: string | null;
  OWNER_BIO: string;
  OWNER_ABOUT: string;
  OWNER_TRAJECTORY: string;
  OWNER_ORG: string;
  OWNER_STATE_NAME: string;
}

const DEFAULTS: ProfileOverrides = {
  OWNER_EMAIL: "user@example.com",
  OWNER_DISPLAY_NAME: null,
  OWNER_BIO:
    "Software engineer building adaptive AI systems with design-forward interfaces and privacy-conscious architecture.",
  OWNER_ABOUT:
    "Building adaptive AI systems that blend rigorous engineering with refined, organic interfaces. Work spans AI orchestration, memory-aware systems, and immersive UI/UX.",
  OWNER_TRAJECTORY:
    "Moving toward AI-native system design, agent orchestration, memory-centric AI platforms, and visually refined, technically serious products.",
  OWNER_ORG: "Independent",
  OWNER_STATE_NAME: "User",
};

let _overrides: ProfileOverrides | null = null;

function load(): ProfileOverrides {
  if (_overrides) return _overrides;

  try {
    // Dynamic require so the build doesn't fail when the file is absent.
    const mod = require("@/../.local-profile-overrides") as Partial<ProfileOverrides>;
    _overrides = { ...DEFAULTS, ...mod };
  } catch {
    _overrides = DEFAULTS;
  }

  return _overrides;
}

export function getOwnerEmail(): string {
  return load().OWNER_EMAIL;
}
export function getOwnerDisplayName(): string | null {
  return load().OWNER_DISPLAY_NAME;
}
export function getOwnerBio(): string {
  return load().OWNER_BIO;
}
export function getOwnerAbout(): string {
  return load().OWNER_ABOUT;
}
export function getOwnerTrajectory(): string {
  return load().OWNER_TRAJECTORY;
}
export function getOwnerOrg(): string {
  return load().OWNER_ORG;
}
export function getOwnerStateName(): string {
  return load().OWNER_STATE_NAME;
}
