import type { KnowledgeCapsuleSlots } from "@/lib/llm/knowledge-capsule-title";

export type CapsuleFixture = {
  id: string;
  label: string;
  /** Conversation summary fed to the short-title step (or shown as sample). */
  summary: string;
  /** Example raw model output for offline parse demos. */
  rawModelOutput: string;
  /** Expected slots after a clean parse (when the raw JSON is well-formed). */
  expectedSlots?: KnowledgeCapsuleSlots;
  note?: string;
};

export const CAPSULE_FIXTURES: CapsuleFixture[] = [
  {
    id: "postgres-schema",
    label: "Design order schema",
    summary:
      "User asked to design a Postgres schema for orders and line items; assistant proposed normalized tables with foreign keys.",
    rawModelOutput: '{"action":"Design","subject":"order schema","additional":""}',
    expectedSlots: { action: "Design", subject: "order schema", additional: "" },
  },
  {
    id: "hydration",
    label: "Fix Next hydration",
    summary:
      "Debugging Next.js hydration mismatch on the landing page after upgrading React.",
    rawModelOutput: '{"action":"Fix","subject":"Next hydration","additional":""}',
    expectedSlots: { action: "Fix", subject: "Next hydration", additional: "" },
  },
  {
    id: "weather",
    label: "SF weather · May 3",
    summary:
      "User asked for today's weather in San Francisco on May 3; assistant gave the forecast.",
    rawModelOutput: '{"action":"","subject":"SF weather","additional":"May 3"}',
    expectedSlots: { action: "", subject: "SF weather", additional: "May 3" },
  },
  {
    id: "greeting",
    label: "New chat",
    summary: "User and assistant exchanged greetings only; no task discussed.",
    rawModelOutput: '{"action":"","subject":"New chat","additional":""}',
    expectedSlots: { action: "", subject: "New chat", additional: "" },
  },
  {
    id: "overlong-drift",
    label: "Model drifts over 5 words",
    summary: "User wants help planning a weekend trip to Kyoto with restaurants and trains.",
    rawModelOutput:
      '{"action":"Plan weekend","subject":"Kyoto trip","additional":"food trains"}',
    note: "Each slot ≤2 words but combined is 6 — repair should drop trailing additional.",
    expectedSlots: { action: "Plan weekend", subject: "Kyoto trip", additional: "food" },
  },
  {
    id: "freeform",
    label: "Freeform line (no JSON)",
    summary: "User asked for a polite decline email for a vendor proposal.",
    rawModelOutput: "Draft vendor decline email note",
    note: "JSON parse fails → freeform word split + normalize.",
  },
];
