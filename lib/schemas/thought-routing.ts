import { z } from "zod";

/**
 * One thought after the orchestrator splitter/router pass.
 * Shells can render which thought went where without owning layout.
 */
export const ThoughtDispositionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("direct"),
    reason: z.string().min(1),
  }),
  z.object({
    kind: z.literal("existing_subagent"),
    agentId: z.string().min(1),
    reason: z.string().min(1),
  }),
  z.object({
    kind: z.literal("new_subagent"),
    /** Suggested display role for the spawned worker. */
    suggestedRole: z.string().min(1),
    reason: z.string().min(1),
  }),
]);

export type ThoughtDisposition = z.infer<typeof ThoughtDispositionSchema>;

export const RoutedThoughtSchema = z.object({
  thoughtId: z.string().min(1),
  text: z.string().min(1),
  disposition: ThoughtDispositionSchema,
});

export type RoutedThought = z.infer<typeof RoutedThoughtSchema>;

export const ThoughtRoutingResultSchema = z.object({
  /** Source text before split. */
  sourceText: z.string(),
  /** Whether the router treated the input as a single thought. */
  singleThought: z.boolean(),
  thoughts: z.array(RoutedThoughtSchema).min(1),
  /**
   * Always true for this path — routing forces AI Gateway ZDR.
   * Surfaced so tests and callers can assert the contract.
   */
  zeroDataRetention: z.literal(true),
  /** Catalog gateway id used for the routing pass (Jev when primary). */
  routerModelId: z.string().min(1),
  /**
   * True when the deterministic heuristic ran because the Jev call threw.
   * Never silent — shells and tests can see the fallback.
   */
  usedHeuristicFallback: z.boolean().default(false),
  /** Present when {@link usedHeuristicFallback} is true. */
  fallbackReason: z.string().min(1).optional(),
});

export type ThoughtRoutingResult = z.infer<typeof ThoughtRoutingResultSchema>;

export const MultitaskAssignedGoalSchema = z.object({
  goalId: z.string().min(1),
  agentId: z.string().min(1),
  goal: z.string().min(1),
});

export const MultitaskInboundDispatchSchema = z.object({
  sendTarget: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("orchestrator") }),
    z.object({ kind: z.literal("subagent"), agentId: z.string().min(1) }),
  ]),
  /**
   * `routed` = orchestrator ran the splitter.
   * `direct_to_subagent` = whole message delivered to one worker; no re-split.
   */
  mode: z.enum(["routed", "direct_to_subagent"]),
  routing: ThoughtRoutingResultSchema.optional(),
  /** Present when mode is direct_to_subagent. */
  deliveredAgentId: z.string().min(1).optional(),
  deliveredText: z.string().min(1).optional(),
  /** Worker goals kicked off this turn (for shell cards). */
  assignedGoals: z.array(MultitaskAssignedGoalSchema).optional(),
  /** Thoughts the orchestrator should answer inline. */
  directThoughts: z.array(z.string()).optional(),
});

export type MultitaskInboundDispatch = z.infer<typeof MultitaskInboundDispatchSchema>;
