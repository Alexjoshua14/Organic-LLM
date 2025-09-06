import { defaultOrganicState } from "@/lib/schemas/organicStateSchema";
import {
  applyOps,
  extractOpsEnvelopeFromText,
} from "@/lib/llm/organicStateProtocol";

const msg = `
Some narrative answer…
\`\`\`json
{
  "ops": [
    { "type": "add_key_insight", "text": "Haptics must be event-aligned <10ms to feel snapped.", "tags": ["Haptics","UX"], "importance": 5 },
    { "type": "add_tech_stack_item", "name": "App Intents", "category": "native", "notes": "Shortcuts + Siri entrypoints" },
    { "type": "update_checkpoint", "checkpointId": "system_surface", "status": "in_progress", "note": "Live Activity prototype started" }
  ]
}
\`\`\`
`;

(async () => {
  const env = extractOpsEnvelopeFromText(msg);
  if (!env) {
    throw new Error("Failed to extract ops envelope from message");
  }

  const next = await applyOps(defaultOrganicState(), env);

  console.log(
    "Insights:",
    next.keyInsights.length,
    "Tech:",
    next.techStack.length,
    "Checkpoint:",
    next.checkpoints.find((c) => c.id === "system_surface")?.status
  );
})();

/**
 * Expected Output from Smoke Test:
 *  `Insights: 1 Tech: 1 Checkpoint:  in_progress`;
 **/
