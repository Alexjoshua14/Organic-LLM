"use client";

import type { ComponentProps } from "react";

import { RabbitHoleToolPresence } from "@/components/chat/rabbit-hole-tool-presence";

type Fixture = Omit<ComponentProps<typeof RabbitHoleToolPresence>, "onOpenNode">;

const SESSION = "00000000-0000-4000-8000-000000000001";
const UPDATED = "2026-11-02T10:00:00.000Z";

/** Stubbed data only: the lab renders the real chat component, never a copy of it. */
const FIXTURES: Array<{ id: string; fixture: Fixture }> = [
  {
    id: "starting",
    fixture: {
      toolName: "create_rabbit_hole",
      state: "in-flight",
      input: { query: "How do agents keep a consistent first-person memory?" },
    },
  },
  {
    id: "created",
    fixture: {
      toolName: "create_rabbit_hole",
      state: "complete",
      input: { query: "How do agents keep a consistent first-person memory?" },
      output: {
        ok: true,
        sessionId: SESSION,
        nodeId: "root",
        title: "First-person memory in agents",
        status: "generating",
      },
    },
  },
  {
    id: "branch",
    fixture: {
      toolName: "create_rabbit_hole_node",
      state: "complete",
      output: {
        ok: true,
        sessionId: SESSION,
        nodeId: "tone",
        parentNodeId: "identity",
        parentTitle: "Identity as a retrieval problem",
        sessionTitle: "First-person memory in agents",
        title: "Tone drift across long threads",
        status: "generating",
      },
    },
  },
  {
    id: "search",
    fixture: {
      toolName: "search_rabbit_holes",
      state: "complete",
      input: { query: "persona memory extraction" },
      output: {
        ok: true,
        query: "persona memory extraction",
        results: [
          {
            sessionId: SESSION,
            title: "First-person memory in agents",
            description:
              "How an assistant extracts durable facts from conversation and keeps its persona consistent while it does.",
            nodeCount: 6,
            updatedAt: UPDATED,
            matchedTerms: ["persona", "memory", "extraction"],
            matchingNodes: [
              { nodeId: "a", title: "Memory extraction pipelines" },
              { nodeId: "b", title: "Persona as a retrieval prior" },
            ],
          },
          {
            sessionId: "00000000-0000-4000-8000-000000000002",
            title: "The AI-native OS race",
            description: "What will actually decide which assistant becomes the operating layer.",
            nodeCount: 4,
            updatedAt: "2026-10-28T10:00:00.000Z",
            matchedTerms: ["memory"],
            matchingNodes: [{ nodeId: "c", title: "Memory as the moat" }],
          },
          {
            sessionId: "00000000-0000-4000-8000-000000000003",
            title: "Orb interfaces for voice agents",
            description: "Ambient presence, turn-taking cues and the persona an orb implies.",
            nodeCount: 3,
            updatedAt: "2026-10-20T10:00:00.000Z",
            matchedTerms: ["persona"],
            matchingNodes: [],
          },
          ...["Cursor Auto: what's knowable", "Beyond coding", "A minimal OS, from boot"].map(
            (title, index) => ({
              sessionId: `00000000-0000-4000-8000-00000000001${index}`,
              title,
              description: title,
              nodeCount: 2 + index,
              updatedAt: "2026-10-01T10:00:00.000Z",
              matchedTerms: ["memory"],
              matchingNodes: [],
            })
          ),
        ],
      },
    },
  },
  {
    id: "session",
    fixture: {
      toolName: "get_rabbit_hole",
      state: "complete",
      output: {
        ok: true,
        sessionId: SESSION,
        title: "First-person memory in agents",
        description: "How an assistant extracts durable facts and keeps one voice.",
        updatedAt: UPDATED,
        rootNodeId: "root",
        generatingNodeId: "tone",
        nodeCount: 5,
        nodes: [
          { nodeId: "root", title: "First-person memory in agents", parentNodeId: null },
          { nodeId: "identity", title: "Identity as a retrieval problem", parentNodeId: "root" },
          { nodeId: "tone", title: "Tone drift across long threads", parentNodeId: "identity" },
          { nodeId: "extract", title: "Memory extraction pipelines", parentNodeId: "root" },
          { nodeId: "eval", title: "Evaluating recall honestly", parentNodeId: "extract" },
        ],
      },
    },
  },
  {
    id: "article",
    fixture: {
      toolName: "get_rabbit_hole_node",
      state: "complete",
      output: {
        ok: true,
        sessionId: SESSION,
        nodeId: "identity",
        title: "Identity as a retrieval problem",
        userQuestion: "Is an agent's identity just what it retrieves about itself?",
        childNodeIds: ["tone"],
        sections: [
          { index: 0, id: "s0", heading: "The self as context" },
          { index: 1, id: "s1", heading: "What gets retrieved first" },
          { index: 2, id: "s2", heading: "Failure modes" },
        ],
        keyTakeaways: [
          "An agent's persona is mostly whatever its retrieval surfaces first.",
          "Stable identity needs a small, always-loaded core, not more memories.",
          "Drift shows up as tone before it shows up as facts.",
          "Evaluations should test recall under conflicting memories.",
        ],
      },
    },
  },
  {
    id: "failed",
    fixture: {
      toolName: "create_rabbit_hole",
      state: "complete",
      input: { query: "Quantum error correction" },
      output: { ok: false, error: "Spending limit reached for today." },
    },
  },
];

const stubKeyPoints = async () => [
  "Durable facts are extracted after the turn, not during it.",
  "The persona is a retrieval prior, re-read every turn.",
  "Conflicting memories resolve by recency and source.",
];

/** Every rabbit-hole tool shape, stacked as it would appear down a thread. */
export function RabbitHoleToolFixtures() {
  return (
    <div className="grid gap-stack-lg">
      {FIXTURES.map(({ id, fixture }) => (
        <RabbitHoleToolPresence
          key={id}
          {...fixture}
          loadKeyPoints={stubKeyPoints}
          showToolDetails={false}
          onOpenNode={() => {}}
        />
      ))}
    </div>
  );
}
