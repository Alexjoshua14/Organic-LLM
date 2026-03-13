/**
 * Fixture data for Rabbit Holes sandbox scenarios.
 */

import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

export const TITLE_SCENARIO_SEED_SESSION: RabbitHoleSessionMetadata = {
  sessionId: "sandbox-title",
  rootQuestion: "Sample exploration",
  summary: "Sample summary",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pathLength: 1,
};

export const SAMPLE_ARTICLES = [
  {
    id: "art-1",
    title: "The Rise of Decentralized Systems",
    content:
      "Decentralized systems have transformed how we think about trust and coordination. From blockchain to federated networks, the shift away from central control continues to reshape technology and society. Key themes include resilience, transparency, and new economic models.",
  },
  {
    id: "art-2",
    title: "Deep Dive: Consciousness and Computation",
    content:
      "What does it mean for a system to be conscious? Philosophers and AI researchers grapple with the hard problem of consciousness. This article explores integrated information theory, global workspace theory, and the boundaries between simulation and experience.",
  },
  {
    id: "art-3",
    title: "Ecology of Thought",
    content:
      "Ideas spread and evolve like species. Memetics, cultural evolution, and the ecology of attention offer frameworks for understanding how thoughts compete, mutate, and persist. We examine the conditions that make some ideas stick and others fade.",
  },
] as const;

export const REFINEMENT_SCENARIO_SEED = {
  pathHistory: "Introduction to quantum mechanics → Wave-particle duality → Measurement problem",
};
