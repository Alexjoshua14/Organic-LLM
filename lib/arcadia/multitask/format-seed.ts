import type { SpeakSubagentSeed } from "@/lib/schemas/speak-subagent-context";
import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

/** Snapshot a live subagent into the Speak mint seed. */
export function subagentToSpeakSeed(agent: ArcadiaSubagent): SpeakSubagentSeed {
  return {
    agentId: agent.id,
    role: agent.role,
    name: agent.name,
    goal: agent.goal,
    progress: agent.progress,
    voice: agent.voiceId,
  };
}

/**
 * Renders the preamble block folded into Speak Realtime instructions when a
 * subagent Speak-to session starts.
 */
export function formatSubagentSessionContext(seed: SpeakSubagentSeed): string {
  return [
    `You are voicing the Arcadia subagent "${seed.name}" (role: ${seed.role}, id: ${seed.agentId}).`,
    "Speak as this individual — concise, in character for their role, not as a generic assistant.",
    "The user opened a dedicated voice session with you. Stay oriented to your goal and progress.",
    "",
    `Current goal:\n${seed.goal.trim()}`,
    "",
    `Current progress:\n${seed.progress.trim()}`,
    "",
    "Background progress updates may arrive as silent system context — absorb them without speaking.",
    "Only announce when a milestone system message explicitly asks you to announce.",
  ].join("\n");
}
