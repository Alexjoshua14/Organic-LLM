export type KeyType = "vowel" | "consonant" | "number" | "special";

export type KeyAnimationConfig = {
  keyType: KeyType;
  gradient: [string, string];
  direction: "up" | "down" | "center" | "pulse";
  opacity: number;
  duration: number;
};

const vowelRegex = /^[aeiou]$/i;
const consonantRegex = /^[a-z]$/i;
const numberRegex = /^[0-9]$/;

const KEY_ANIMATIONS: Record<KeyType, KeyAnimationConfig> = {
  vowel: {
    keyType: "vowel",
    gradient: ["#ff72e1", "#9a62ff"],
    direction: "up",
    opacity: 0.06,
    duration: 260,
  },
  consonant: {
    keyType: "consonant",
    gradient: ["#4ac4f7", "#00a2c7"],
    direction: "down",
    opacity: 0.05,
    duration: 240,
  },
  number: {
    keyType: "number",
    gradient: ["#e5e7eb", "#a0aec0"],
    direction: "center",
    opacity: 0.04,
    duration: 200,
  },
  special: {
    keyType: "special",
    gradient: ["#9ef4d1", "#4ade80"],
    direction: "pulse",
    opacity: 0.07,
    duration: 300,
  },
};

export function categorizeKey(key: string): KeyAnimationConfig {
  if (vowelRegex.test(key)) {
    return KEY_ANIMATIONS.vowel;
  }

  if (consonantRegex.test(key)) {
    return KEY_ANIMATIONS.consonant;
  }

  if (numberRegex.test(key)) {
    return KEY_ANIMATIONS.number;
  }

  return KEY_ANIMATIONS.special;
}
