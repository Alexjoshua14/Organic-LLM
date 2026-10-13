import type { MultitaskInboundDispatch } from "@/lib/schemas/thought-routing";

/** Compact system-prompt fragment so the turn LLM sees the routing decision. */
export function formatMultitaskRoutingSystemFragment(
  dispatch: MultitaskInboundDispatch
): string {
  if (dispatch.mode === "direct_to_subagent") {
    return [
      "[Multitask send target]",
      `User addressed subagent ${dispatch.deliveredAgentId} directly.`,
      "Do not re-split this message onto other agents.",
      `Delivered text: ${dispatch.deliveredText ?? ""}`,
    ].join("\n");
  }

  const thoughts = dispatch.routing?.thoughts ?? [];
  const lines = thoughts.map((t, i) => {
    const d = t.disposition;
    const dest =
      d.kind === "direct"
        ? "orchestrator (direct reply)"
        : d.kind === "existing_subagent"
          ? `existing worker ${d.agentId}`
          : `new worker (${d.suggestedRole})`;

    return `${i + 1}. [${dest}] ${t.text} — ${d.reason}`;
  });

  return [
    "[Multitask thought routing]",
    "The user message was split for the orchestrator. Direct thoughts: answer briefly.",
    "Routed thoughts are assigned worker goals — acknowledge delegation; do not do long work inline.",
    ...lines,
  ].join("\n");
}
