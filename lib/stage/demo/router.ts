import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { STAGE_DEMO_SCENES } from "./scenes";

import { models } from "@/lib/schemas/chat-models";

const SCENE_IDS = STAGE_DEMO_SCENES.map((scene) => scene.id) as [string, ...string[]];
const ROUTER_TIMEOUT_MS = 6_000;

const catalog = STAGE_DEMO_SCENES.map((scene) => `- ${scene.id}: ${scene.cue}`).join("\n");

// Words that point at a scene when the model is slow or unavailable, so the demo never stalls.
const KEYWORDS: [string, RegExp][] = [
  ["plan-dinner", /\b(dinner|recipe|cook|meal|grocer|shopping|soup)\b/i],
  ["read-the-web", /\b(page|website|web|docs?|article|read|wikipedia|link)\b/i],
  ["map-idea", /\b(map|diagram|flow|structure|explain|how does|system)\b/i],
  ["specialists", /\b(research|deep|compare|specialists?|parallel|investigate)\b/i],
  ["brain-dump", /\b(head|thoughts?|ideas?|todo|to-do|remember|worr|mind)\b/i],
  ["blank", /\b(clear|reset|start over|blank|empty stage)\b/i],
];

export function keywordScene(message: string): string | null {
  return KEYWORDS.find(([, pattern]) => pattern.test(message))?.[0] ?? null;
}

/** Picks which prebuilt scene answers the user's message. Never invents content. */
export async function routeStageDemo(message: string, currentSceneId: string): Promise<string> {
  try {
    const { output } = await generateText({
      model: models.google.flashLite_3_1.id,
      instructions: `You direct a demo of a spatial workspace. Pick the one scene that best fits what the user just said. If they ask for something already shown, keep the current scene (${currentSceneId}). Scenes:\n${catalog}`,
      prompt: message.slice(0, 500),
      output: Output.object({ schema: z.object({ scene: z.enum(SCENE_IDS) }) }),
      maxOutputTokens: 60,
      abortSignal: AbortSignal.timeout(ROUTER_TIMEOUT_MS),
      providerOptions: { gateway: { zeroDataRetention: true } },
    });

    return output.scene;
  } catch {
    return keywordScene(message) ?? currentSceneId;
  }
}
