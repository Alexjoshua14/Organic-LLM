import { randomBytes } from "node:crypto";

import { DEFAULT_TTL_SECONDS, ORCHESTRATION_APPENDIX, PAYLOAD_VERSION } from "./constants";
import type {
  IntrospectionBootstrapPayload,
  IntrospectionHandoffRequest,
  OrganicHandoffContent,
} from "./schemas";
import {
  IntrospectionBootstrapPayloadSchema,
  OrganicHandoffContentSchema,
} from "./schemas";

const DEFAULT_STEPS: OrganicHandoffContent["steps"] = [
  { id: "orient", title: "Orient", hint: "Name the core tension in your own words." },
  { id: "explore", title: "Explore", hint: "Follow one thread with concrete examples." },
  { id: "integrate", title: "Integrate", hint: "Land on one insight you can act on." },
];

export function buildOrganicHandoffContentFromHandoff(
  input: IntrospectionHandoffRequest,
): OrganicHandoffContent {
  const title = input.promptTitle;
  const goal = `Reflect on: ${input.questionText}`;
  const systemInstructions = `${input.fullPrompt}\n\n${ORCHESTRATION_APPENDIX}`;
  const initialOverview = [
    `## ${title}`,
    "",
    input.questionText,
    "",
    "When you're ready, your guide will walk you through this reflection step by step.",
  ].join("\n");

  return OrganicHandoffContentSchema.parse({
    title,
    goal,
    systemInstructions,
    initialOverview,
    steps: DEFAULT_STEPS,
  });
}

export function buildBootstrapPayloadFromHandoff(
  input: IntrospectionHandoffRequest,
  options?: { exp?: number; nonce?: string },
): IntrospectionBootstrapPayload {
  const content = buildOrganicHandoffContentFromHandoff(input);
  return buildBootstrapPayloadFromContent(content, options);
}

export function buildBootstrapPayloadFromContent(
  content: OrganicHandoffContent,
  options?: { exp?: number; nonce?: string },
): IntrospectionBootstrapPayload {
  const now = Math.floor(Date.now() / 1000);

  return IntrospectionBootstrapPayloadSchema.parse({
    v: PAYLOAD_VERSION,
    exp: options?.exp ?? now + DEFAULT_TTL_SECONDS,
    nonce: options?.nonce ?? randomBytes(16).toString("hex"),
    title: content.title,
    goal: content.goal,
    systemInstructions: content.systemInstructions,
    initialOverview: content.initialOverview,
    steps: content.steps,
  });
}

/** @deprecated Use buildBootstrapPayloadFromHandoff */
export function buildBootstrapPayload(
  input: IntrospectionHandoffRequest,
  options?: { exp?: number; nonce?: string },
): IntrospectionBootstrapPayload {
  return buildBootstrapPayloadFromHandoff(input, options);
}
