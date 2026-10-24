/**
 * Tuning knobs for the Noesis admin demo engine.
 *
 * These are intentionally centralized + commented so the balance between demo size,
 * speed, price-per-demo, and value/frequency of demos can be adjusted in one place.
 * (Isomorphic — imported by both the client overlay and the server routes.)
 */
import type { ChatModelId } from "@/lib/schemas/chat";

/** Default ultracheap model for demo runs (swappable live via CoreInput). */
export const DEMO_DEFAULT_MODEL: ChatModelId = "google/gemini-3-flash";

/**
 * Hard ceiling on total tokens spent per demo run (input + output, all turns).
 * TUNING KNOB — raise/lower as the size/speed/price/value tradeoff gets dialed in.
 */
export const DEMO_TOKEN_BUDGET = 25_000;

/**
 * Number of spark (assistant) replies per demo run:
 *   [kickoff user → reply], then [NPC user → reply] × 2  ⇒  3 replies.
 * TUNING KNOB.
 */
export const DEMO_REPLY_CYCLES = 3;

/**
 * Output-token cap for each spark reply. Sized so the worst case
 * (`DEMO_REPLY_CYCLES` × this + growing input) stays comfortably under the budget.
 */
export const DEMO_MAX_OUTPUT_TOKENS_PER_TURN = 800;

/** Output-token cap for each NPC user turn (NPC messages are intentionally short). */
export const DEMO_NPC_MAX_OUTPUT_TOKENS = 200;
