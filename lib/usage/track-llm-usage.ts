import "server-only";

import { insertLlmUsageEvent, type TrackLlmUsageInput } from "@/data/supabase/llm-usage";

/** Fire-and-forget LLM usage persistence for the usage overlay. */
export function trackLlmUsageEvent(input: TrackLlmUsageInput): void {
  void insertLlmUsageEvent(input).catch(() => {
    /* logged in data layer */
  });
}
