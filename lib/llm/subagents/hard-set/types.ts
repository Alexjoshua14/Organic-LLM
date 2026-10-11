import { z } from "zod";

/**
 * A hard-set subagent: a fixed, code-defined agent with its own identity, instructions, tools,
 * and reflexive help menu. Developed in a shell thread (Sandbox → Subagent lab) where the owner
 * talks to it directly. See `./README.md`.
 */
export const HardSetSubagentSchema = z.object({
  /** Stable id stored on the shell thread (`threads.subagent_agent_id`). `subagent-<slug>`. */
  id: z.string().regex(/^subagent-[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(40),
  role: z.string().min(1).max(40),
  /** One line: what this subagent is for. Shown in the lab list. */
  blurb: z.string().min(1).max(160),
  /** The subagent's own instructions — its system prompt fragment for every turn in its shell. */
  instructions: z.string().min(1).max(12_000),
  /**
   * Reflexive help menu (markdown). Sent without a model call when Jev judges the user is only
   * asking for help or unsure what to do. Also seeds every new shell thread.
   */
  helpMenu: z.string().min(1).max(4_000),
  /**
   * Locked into the orchestrator's roster: the orchestrator can dispatch to it, and it always
   * runs on these instructions. Assignments direct its work; they cannot change its persona,
   * role, or boundaries. Off = shell only, while it is still in development.
   */
  roster: z.boolean().default(false),
  /**
   * Tool policy. Each flag forces a tool on or off for this subagent; omitted flags follow the
   * composer toggles, as in normal chat.
   */
  tools: z
    .object({
      webSearch: z.boolean().optional(),
      memory: z.boolean().optional(),
      chatHistory: z.boolean().optional(),
    })
    .default({}),
});

export type HardSetSubagent = z.infer<typeof HardSetSubagentSchema>;
export type HardSetSubagentInput = z.input<typeof HardSetSubagentSchema>;

/** Validate a definition at module load, so a malformed subagent fails tests, not a turn. */
export function defineHardSetSubagent(definition: HardSetSubagentInput): HardSetSubagent {
  return HardSetSubagentSchema.parse(definition);
}
