export type NoesisSparkSource = "memory" | "thread" | "wildcard";

export type NoesisSpark = {
  text: string;
  source: NoesisSparkSource;
};

export type WelcomeNoesisScenario = {
  sparks: readonly [NoesisSpark, NoesisSpark, NoesisSpark, NoesisSpark];
  /** Which spark the demo selects (0–3). */
  selectedSparkIndex: number;
  assistantReply1: string;
  assistDraft: string;
  assistantReply2: string;
};

export const NOESIS_SPARK_SOURCE_LABEL: Record<NoesisSparkSource, string> = {
  memory: "From memory",
  thread: "From a thread",
  wildcard: "Wildcard",
};

export const WELCOME_NOESIS_SCENARIOS: readonly WelcomeNoesisScenario[] = [
  {
    sparks: [
      {
        source: "memory",
        text: "Does recalled memory change which tools run?",
      },
      {
        source: "memory",
        text: "Revisit the rabbit-hole → chat handoff",
      },
      {
        source: "thread",
        text: "Still open: ZDR and your default model?",
      },
      {
        source: "wildcard",
        text: "What would make threads easier to resume?",
      },
    ],
    selectedSparkIndex: 0,
    assistantReply1:
      "Worth probing. Memory search often runs before tools—but the trace is easy to miss mid-reply.",
    assistDraft: "Can retrieval calls show up per turn, like fingerprints?",
    assistantReply2:
      "Exactly. Each turn could show which memory queries ran, so the thread reads as a chain—not isolated prompts.",
  },
  {
    sparks: [
      {
        source: "memory",
        text: "Pressure-test memory search before each reply",
      },
      {
        source: "thread",
        text: "Pick up the Strata export thread from Friday",
      },
      {
        source: "thread",
        text: "Unresolved: when to branch vs stay in chat?",
      },
      {
        source: "wildcard",
        text: "Challenge one assumption in today's plan",
      },
    ],
    selectedSparkIndex: 1,
    assistantReply1:
      "Friday's export thread left the Strata handoff half-framed. Want to name what still feels unresolved?",
    assistDraft: "Whether export should wait until rabbit-hole sources are cited.",
    assistantReply2:
      "That constraint would keep the thread spine intact. You could branch once citations stabilize.",
  },
] as const;
