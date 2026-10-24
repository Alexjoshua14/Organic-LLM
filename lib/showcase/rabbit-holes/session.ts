/**
 * Synthetic rabbit-hole session for the public showcase. Facts come from SHOWCASE_STORY.
 * Parsed at load so a bad fixture fails tests on import. Nothing here is fetched.
 */

import type { RabbitHoleBranchSuggestion, RabbitHoleNode } from "@/lib/schemas/rabbitHoleSchemas";

import { RabbitHoleSessionSchema } from "@/lib/schemas/rabbitHoleSchemas";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";

export const RABBIT_HOLES_SESSION_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
export const ROOT_NODE_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
export const BAY_NODE_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
export const MOON_NODE_ID = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
export const SKYGLOW_NODE_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

const CREATED_AT = "2026-04-11T19:30:00.000Z";

const { science, premise, home, timing, sites } = SHOWCASE_STORY;

const pointReyes = sites.find((site) => site.id === "point-reyes");

if (!pointReyes) {
  throw new Error("SHOWCASE_STORY is missing the Point Reyes site");
}

function sentence(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export type DemoArticleBlock = { type: "p"; text: string };

const baySuggestion: RabbitHoleBranchSuggestion = {
  id: "bay-area",
  label: "When is the core visible from the Bay Area?",
  shortDescription: "Core season from San Francisco, and why a new moon matters.",
};

const moonSuggestion: RabbitHoleBranchSuggestion = {
  id: "new-moon",
  label: "Why a new moon matters",
  shortDescription: "Moonlight washes out the fainter structure of the core.",
};

const skyglowSuggestion: RabbitHoleBranchSuggestion = {
  id: "skyglow",
  label: "How dark is the sky over San Francisco?",
  shortDescription: "Skyglow and the Bortle scale for a first shoot from the city.",
};

const BRANCH_NODE_ID: Record<string, string> = {
  [baySuggestion.id]: BAY_NODE_ID,
  [moonSuggestion.id]: MOON_NODE_ID,
  [skyglowSuggestion.id]: SKYGLOW_NODE_ID,
};

export function branchNodeIdFor(branchId: string): string | null {
  return BRANCH_NODE_ID[branchId] ?? null;
}

const PROSE: Record<string, readonly DemoArticleBlock[]> = {
  [ROOT_NODE_ID]: [
    {
      type: "p",
      text: `The core is ${science.coreDistance}. It is the dense center of the galaxy — the bright heart of the band you're hoping to photograph.`,
    },
    {
      type: "p",
      text: `${premise} You're starting from ${home}. Core season is ${science.coreSeason}. ${sentence(science.moon)}. ${sentence(science.skyglow)}.`,
    },
  ],
  [BAY_NODE_ID]: [
    {
      type: "p",
      text: `From ${home}, core season is ${science.coreSeason}. The core is ${science.coreDistance} — a seasonal target from the Bay, not an all-year one.`,
    },
    {
      type: "p",
      text: `${sentence(science.moon)}. Even then, ${science.skyglow}. ${pointReyes.name} is the closest place in the plan, about ${pointReyes.driveHours} hours from ${home}, and it still has more Bay Area skyglow than a darker site.`,
    },
  ],
  [MOON_NODE_ID]: [
    {
      type: "p",
      text: `${sentence(science.moon)}. For a first photograph of the core, that is the difference between structure the camera can separate and a sky flooded with moonlight.`,
    },
    {
      type: "p",
      text: `The timing in the plan is ${timing}. Skyglow is the other limit — ${science.skyglow} — and a new moon does not remove it.`,
    },
  ],
  [SKYGLOW_NODE_ID]: [
    {
      type: "p",
      text: `${sentence(science.skyglow)}. From ${home}, that scattered light is why the core is hard to see from the city itself.`,
    },
    {
      type: "p",
      text: `${sentence(science.bortle)}. ${pointReyes.name}, about ${pointReyes.driveHours} hours away, is the closest option in the plan, and it still carries more Bay Area skyglow.`,
    },
  ],
};

export function rabbitHoleDemoProse(nodeId: string): readonly DemoArticleBlock[] {
  return PROSE[nodeId] ?? [];
}

function articleHtml(nodeId: string): string {
  return rabbitHoleDemoProse(nodeId)
    .map((block) => `<p>${escapeHtml(block.text)}</p>`)
    .join("");
}

function demoNode(args: {
  id: string;
  title: string;
  userQuestion: string;
  summary: string;
  keyTakeaways: string[];
  branchSuggestions: RabbitHoleBranchSuggestion[];
}): RabbitHoleNode {
  return {
    id: args.id,
    title: args.title,
    rawPrompt: "Scripted showcase fixture. Synthetic copy for the public rabbit-holes demo.",
    userQuestion: args.userQuestion,
    refinedQuestion: args.userQuestion,
    preview: args.summary,
    summary: args.summary,
    keyTakeaways: args.keyTakeaways,
    articleHtml: articleHtml(args.id),
    branchSuggestions: args.branchSuggestions,
    createdAt: CREATED_AT,
  };
}

const rootTitle = "The Milky Way's core";
const bayTitle = "Seeing the core from the Bay Area";
const moonTitle = "Why a new moon matters";
const skyglowTitle = "Skyglow over San Francisco";

const nodesById: Record<string, RabbitHoleNode> = {
  [ROOT_NODE_ID]: demoNode({
    id: ROOT_NODE_ID,
    title: rootTitle,
    userQuestion: "What is the Milky Way's core?",
    summary: `${premise} The core is ${science.coreDistance}. From ${home}, season, moonlight, and skyglow decide whether that glow shows up in the frame.`,
    keyTakeaways: [
      `The core is ${science.coreDistance}.`,
      `Core season is ${science.coreSeason}.`,
      `${sentence(science.moon)}.`,
      `${sentence(science.bortle)}.`,
      `A first shoot from ${home} still faces skyglow. ${sentence(science.skyglow)}.`,
    ],
    branchSuggestions: [baySuggestion, moonSuggestion, skyglowSuggestion],
  }),
  [BAY_NODE_ID]: demoNode({
    id: BAY_NODE_ID,
    title: bayTitle,
    userQuestion:
      "When is the Milky Way's core visible from the Bay Area, and why does a new moon matter?",
    summary: `From ${home}, the core is a seasonal target — ${science.coreSeason}. ${sentence(science.moon)}, but city skyglow still hides faint stars over the Bay.`,
    keyTakeaways: [
      `Core season is ${science.coreSeason}.`,
      `${sentence(science.moon)}.`,
      `${pointReyes.name} is the closest option in the plan, about ${pointReyes.driveHours} hours away, with more Bay Area skyglow.`,
      `${sentence(science.skyglow)}.`,
    ],
    branchSuggestions: [moonSuggestion, skyglowSuggestion],
  }),
  [MOON_NODE_ID]: demoNode({
    id: MOON_NODE_ID,
    title: moonTitle,
    userQuestion: "Why does a new moon matter for photographing the core?",
    summary: `${sentence(science.moon)}. For this first shoot, the timing to aim for is ${timing}.`,
    keyTakeaways: [
      `${sentence(science.moon)}.`,
      `The plan aims for ${timing}.`,
      `Moonlight is a different problem from skyglow: ${science.skyglow}.`,
    ],
    branchSuggestions: [baySuggestion, skyglowSuggestion],
  }),
  [SKYGLOW_NODE_ID]: demoNode({
    id: SKYGLOW_NODE_ID,
    title: skyglowTitle,
    userQuestion: "How does skyglow over San Francisco affect the Milky Way?",
    summary: `From ${home}, ${science.skyglow}. ${sentence(science.bortle)}.`,
    keyTakeaways: [
      `${sentence(science.skyglow)}.`,
      `${sentence(science.bortle)}.`,
      `From ${home}, that glow is why the first shoot leaves the city. ${pointReyes.name} is closer, and it still carries more Bay Area skyglow.`,
    ],
    branchSuggestions: [baySuggestion, moonSuggestion],
  }),
};

export const rabbitHoleDemoSession = RabbitHoleSessionSchema.parse({
  sessionId: RABBIT_HOLES_SESSION_ID,
  rootQuestion: "What is the Milky Way's core?",
  rootNodeId: ROOT_NODE_ID,
  path: [
    { nodeId: ROOT_NODE_ID, label: rootTitle, parentNodeId: null },
    { nodeId: BAY_NODE_ID, label: bayTitle, parentNodeId: ROOT_NODE_ID },
  ],
  nodesById,
  activeNodeId: BAY_NODE_ID,
  generatingNodeId: null,
  generationStep: null,
  edges: [{ from: ROOT_NODE_ID, to: BAY_NODE_ID, type: "follow" }],
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
});

export function rabbitHolePathSegment(nodeId: string): {
  nodeId: string;
  label: string;
  parentNodeId: string | null;
} {
  const node = rabbitHoleDemoSession.nodesById[nodeId];

  if (!node) {
    throw new Error(`Rabbit hole demo has no node "${nodeId}"`);
  }

  return {
    nodeId,
    label: node.title ?? node.userQuestion,
    parentNodeId: nodeId === ROOT_NODE_ID ? null : ROOT_NODE_ID,
  };
}
