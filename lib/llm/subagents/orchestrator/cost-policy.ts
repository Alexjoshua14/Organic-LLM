import { models } from "@/lib/schemas/chat-models";

export type SubagentModelTier = "economy" | "standard";

/** Worker models are selected separately from the user's orchestrator model. */
export function selectSubagentModel(args: {
  tier?: SubagentModelTier;
  reason?: string;
  zeroDataRetention: boolean;
}): { ok: true; modelId: string; tier: SubagentModelTier } | { ok: false; error: string } {
  const tier = args.tier ?? "economy";

  if (tier === "standard" && (args.reason?.trim().length ?? 0) < 20) {
    return {
      ok: false,
      error:
        "A standard worker needs a specific reason why the economy model is insufficient (at least 20 characters).",
    };
  }
  const model = tier === "standard" ? models.anthropic.sonnet : models.anthropic.haiku;

  if (args.zeroDataRetention && model.supportsZeroDataRetention !== true) {
    return {
      ok: false,
      error: "The worker model does not support the required zero data retention setting.",
    };
  }

  return { ok: true, modelId: model.id, tier };
}

export function formatSubagentCostPolicy(): string {
  return [
    "- Budget first: answer in this thread when your existing context and tools can produce the requested result. Routine drafting, summarizing, planning, explanations and small edits do not need a specialist.",
    "- Delegate only when the user explicitly asks for a specialist, its tools or expertise are needed, or a distinct substantial deliverable benefits from isolation. Prefer the smallest suitable specialist; do not split one task across several agents merely because their roles overlap.",
    "- Start with one specialist. A second dispatch requires additionalDispatchReason explaining the independent work it adds. Do not start unsolicited review, judging, polishing or redundant research cycles.",
    `- Workers use ${models.anthropic.haiku.name} by default (modelTier=economy), independently of your model. Use modelTier=standard (${models.anthropic.sonnet.name}) only for demanding implementation, architecture or complex evidence synthesis, with modelReason explaining why economy is insufficient. A long brief or a prestigious role alone does not justify an upgrade.`,
    "- Reuse relevant completed results and saved evidence. Check the status summary before dispatch: wait for a working specialist instead of queueing more work for it, and never repeat an assignment just to get an update.",
    "- Give the specialist a bounded deliverable and the minimum sufficient context. Stop once the user's requested result is covered; report missing inputs or unfinished work instead of silently starting another cycle.",
  ].join("\n");
}
