import { z } from "zod";

/**
 * Which thread a new voice session attaches to. `resume-latest` is the provisional product
 * default recorded in `docs/speak/decisions/20260917-voice-continuity-and-memory.md`; the
 * enum exists so the still-open continuity question changes one value, not the mechanism.
 * Client-safe: the hook sends it, the session route validates it.
 */
export const SpeakThreadPolicySchema = z.enum(["resume-latest", "new"]);

export type SpeakThreadPolicy = z.infer<typeof SpeakThreadPolicySchema>;

export const DEFAULT_SPEAK_THREAD_POLICY: SpeakThreadPolicy = "resume-latest";
