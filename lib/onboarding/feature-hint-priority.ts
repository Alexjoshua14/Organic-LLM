import type { FeatureHintId } from "./feature-hints";

/** Lower number = shown first when multiple hints qualify. */
export const FEATURE_HINT_PRIORITY: Record<FeatureHintId, number> = {
  "experience-rail": 10,
  "chat-empty-state": 15,
  "composer-search-memory": 20,
  "composer-auto-model": 21,
  "noesis-sparks": 30,
  "arcadia-starters": 32,
  "arcadia-style-standard": 33,
  "arcadia-style-ergon": 33,
  "arcadia-style-scribe": 33,
  "noesis-suggest-reply": 40,
  "noesis-steer-assist": 41,
  "rabbit-holes-focus": 50,
  "noesis-thread-title": 55,
};

export function compareFeatureHintPriority(a: FeatureHintId, b: FeatureHintId): number {
  return FEATURE_HINT_PRIORITY[a] - FEATURE_HINT_PRIORITY[b];
}
