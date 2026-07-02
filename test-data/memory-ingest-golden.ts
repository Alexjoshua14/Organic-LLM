import type { MemoryIngestGoldenCase } from "@/lib/memory/ingest-quality";

/** Labeled cases for offline + live memory ingest eval. Anonymized fixtures. */
export const MEMORY_INGEST_GOLDEN_CASES: MemoryIngestGoldenCase[] = [
  {
    id: "pref-dark-mode",
    turns: [
      {
        role: "user",
        content: "I always use dark mode everywhere — apps, IDE, phone. Please remember that.",
      },
      {
        role: "assistant",
        content: "Got it — I'll keep dark mode as a standing preference.",
      },
    ],
    expectedFacts: ["dark mode"],
    antiPatterns: ["I will read", "User asked the assistant"],
    probeQueries: ["interface preferences", "dark mode"],
  },
  {
    id: "project-organic-llm",
    turns: [
      {
        role: "user",
        content:
          "I'm building Organic LLM — a web app with AI chat, memory, and particle-based Delphi ingest.",
      },
    ],
    expectedFacts: ["Organic LLM", "memory"],
    antiPatterns: ["[]", "ML type:"],
    probeQueries: ["what project am I building", "Organic LLM"],
  },
  {
    id: "spoken-output-pipeline",
    turns: [
      {
        role: "user",
        content:
          "Spoken output isn't an afterthought for me — TTS and speech-friendly replies are first-class in the product.",
      },
    ],
    expectedFacts: ["spoken", "TTS"],
    probeQueries: ["speech", "TTS preferences"],
  },
  {
    id: "reject-generic-latency",
    turns: [
      {
        role: "assistant",
        content: "Latency tells you how fast the system responds.",
      },
    ],
    expectedFacts: [],
    antiPatterns: ["Latency tells you"],
    probeQueries: ["latency definition"],
  },
  {
    id: "reject-homework-intent",
    turns: [
      {
        role: "user",
        content: "I'll read the migration doc tomorrow and get back to you.",
      },
    ],
    expectedFacts: [],
    antiPatterns: ["I will read", "tomorrow"],
  },
  {
    id: "memory-ingest-eval-interest",
    turns: [
      {
        role: "user",
        content:
          "I want eval harnesses and feedback loops for memory ingest quality — thumbs, delete rates, memory size trends.",
      },
    ],
    expectedFacts: ["memory ingest", "feedback"],
    probeQueries: ["memory quality", "eval"],
  },
  {
    id: "delphi-commit-style",
    turns: [
      {
        role: "user",
        content: "When I say 'file that', store verbatim what we agreed — no inference, one fact per commit.",
      },
    ],
    expectedFacts: ["verbatim", "commit"],
    antiPatterns: ["User asked the assistant to choose"],
  },
  {
    id: "zdr-preference",
    turns: [
      {
        role: "user",
        content: "I keep zero data retention on for external LLM providers whenever the model supports it.",
      },
    ],
    expectedFacts: ["zero data retention"],
    probeQueries: ["ZDR", "zero data retention"],
  },
];

export function getMemoryIngestGoldenCase(id: string): MemoryIngestGoldenCase | undefined {
  return MEMORY_INGEST_GOLDEN_CASES.find((c) => c.id === id);
}
