import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import {
  assertJevRequiresZdr,
  assertRouterForcesZdr,
  createHeuristicThoughtRouter,
  createJevThoughtRouter,
  dispatchMultitaskInbound,
  executeAssignedWorkers,
  jevRouterCallConfig,
  JEV_GATEWAY_MODEL_ID,
  ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS,
  ORCHESTRATOR_RETURN_TARGET_MS,
  decideOrchestratorDelegation,
  runOrchestratorTurn,
  runWorkerGoal,
  runWorkerGoalWithModel,
  OrchestratorAwarenessBus,
  assertNonHumanIdentitySubject,
  buildSubagentIdentityPrompt,
  ensureSubagentIdentityImage,
} from "@/lib/llm/subagents";
import { applyWorkerAwarenessToSubagent } from "@/lib/arcadia/multitask/apply-awareness";
import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import { DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { createLocalIdentityBlobStore } from "@/lib/llm/subagents/identity/local-blob-store";
import { createLocalIdentityMetaStore } from "@/lib/llm/subagents/identity/local-meta-store";
import { models } from "@/lib/schemas/chat-models";

const workers = [
  {
    id: "agent-researcher",
    name: "Lyra",
    role: "researcher",
    goal: "Map approaches to ambient multi-agent presence",
  },
  {
    id: "agent-coder",
    name: "Reed",
    role: "coder",
    goal: "Ship Speak-to session mint path",
  },
];

describe("orchestrator vs worker", () => {
  test("orchestrator delegates long work instead of doing it inline", async () => {
    const result = await runOrchestratorTurn({
      orchestratorId: "aion",
      userRequest: "Research ambient presence for two hours",
      workerAgentId: "agent-researcher",
      complexity: { estimatedDurationMs: ORCHESTRATOR_RETURN_TARGET_MS + 5_000 },
      now: (() => {
        let t = 1_000;
        return () => {
          const cur = t;
          t += 10;
          return cur;
        };
      })(),
    });

    expect(result.disposition).toBe("delegated");
    expect(result.runtimeRole).toBe("orchestrator");
    if (result.disposition === "delegated") {
      expect(result.workerGoal.agentId).toBe("agent-researcher");
    }
    expect(result.returnedWithinTarget).toBe(true);
  });

  test("decideOrchestratorDelegation keeps short work inline", () => {
    const decision = decideOrchestratorDelegation(
      { estimatedDurationMs: 500 },
      {
        orchestratorId: "aion",
        workerAgentId: "agent-coder",
        goal: "Say hi",
      }
    );
    expect(decision.action).toBe("inline");
  });

  test("worker completion and milestones are visible to the orchestrator", async () => {
    const bus = new OrchestratorAwarenessBus();
    const seen: string[] = [];
    bus.subscribe("aion", (e) => seen.push(e.kind));

    const goal = {
      goalId: "g1",
      agentId: "agent-coder",
      goal: "Ship Speak-to",
      assignedAt: 1,
      orchestratorId: "aion",
    };

    await runWorkerGoal({
      goal,
      bus,
      steps: [
        { kind: "progress", narrative: "wiring", progressPct: 40 },
        { kind: "milestone", milestone: { id: "m1", label: "Mint works" } },
        { kind: "completion", summary: "Done" },
      ],
    });

    expect(seen).toEqual(["progress", "milestone", "completion"]);
    expect(bus.list("aion").map((e) => e.kind)).toEqual([
      "progress",
      "milestone",
      "completion",
    ]);
  });
});

describe("Jev catalog + thought routing", () => {
  test("Jev is registered as the house routing model with mandatory ZDR", () => {
    expect(models.openai.jev.id).toBe("openai/gpt-6-jev");
    expect(models.openai.jev.name).toBe("GPT-6 Jev");
    expect(models.openai.jev.picker).toBe(false);
    expect(models.openai.jev.supportsZeroDataRetention).toBe(true);
    expect(models.openai.jev.requiresZeroDataRetention).toBe(true);
    expect(JEV_GATEWAY_MODEL_ID).toBe("openai/gpt-6-jev");
    assertJevRequiresZdr();
  });

  test("jevRouterCallConfig forces ZDR on the model request config", () => {
    const cfg = jevRouterCallConfig();
    expect(cfg.model).toBe("openai/gpt-6-jev");
    expect(cfg.zeroDataRetention).toBe(true);
    expect(cfg.providerOptions.gateway.zeroDataRetention).toBe(true);
    expect(ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS.gateway.zeroDataRetention).toBe(true);
  });

  test("Jev is the router model and the Jev request has ZDR on", async () => {
    let seenZdr: boolean | undefined;
    let seenModel: string | undefined;

    const router = createJevThoughtRouter({
      generate: async (args) => {
        seenModel = args.model;
        seenZdr = args.providerOptions.gateway.zeroDataRetention;
        expect(assertRouterForcesZdr({
          modelId: args.model,
          zeroDataRetention: true,
          providerOptions: args.providerOptions,
          route: async () => {
            throw new Error("unused");
          },
        })).toBe(true);

        return {
          object: {
            thoughts: [
              {
                text: "Can you clarify the scope of this sprint?",
                disposition: {
                  kind: "direct",
                  reason: "clarification for orchestrator",
                },
              },
            ],
          },
        };
      },
    });

    expect(router.modelId).toBe(JEV_GATEWAY_MODEL_ID);
    expect(assertRouterForcesZdr(router)).toBe(true);

    const result = await router.route({
      text: "Can you clarify the scope of this sprint?",
      workers,
    });

    expect(seenModel).toBe("openai/gpt-6-jev");
    expect(seenZdr).toBe(true);
    expect(result.routerModelId).toBe("openai/gpt-6-jev");
    expect(result.zeroDataRetention).toBe(true);
    expect(result.usedHeuristicFallback).toBe(false);
    expect(result.singleThought).toBe(true);
    expect(result.thoughts[0]!.disposition.kind).toBe("direct");
  });

  test("Jev failure falls back to heuristic and labels the fallback", async () => {
    const router = createJevThoughtRouter({
      generate: async () => {
        throw new Error("gateway unavailable");
      },
    });

    const result = await router.route({
      text: "What is the status?\n\nResearch ambient presence approaches in detail.",
      workers,
    });

    expect(result.usedHeuristicFallback).toBe(true);
    expect(result.fallbackReason).toContain("jev_call_failed");
    expect(result.fallbackReason).toContain("gateway unavailable");
    expect(result.routerModelId).toBe(JEV_GATEWAY_MODEL_ID);
    expect(result.zeroDataRetention).toBe(true);
    expect(result.thoughts.length).toBeGreaterThanOrEqual(2);
  });

  test("one thought stays whole", async () => {
    const router = createHeuristicThoughtRouter();
    const result = await router.route({
      text: "Can you clarify the scope of this sprint?",
      workers,
    });
    expect(result.singleThought).toBe(true);
    expect(result.thoughts).toHaveLength(1);
    expect(result.thoughts[0]!.disposition.kind).toBe("direct");
    expect(result.zeroDataRetention).toBe(true);
  });

  test("two thoughts split", async () => {
    const router = createHeuristicThoughtRouter();
    const result = await router.route({
      text: "What is the status?\n\nResearch ambient presence approaches in detail.",
      workers,
    });
    expect(result.singleThought).toBe(false);
    expect(result.thoughts.length).toBeGreaterThanOrEqual(2);
  });

  test("direct thought is answered by the orchestrator; task routes to existing worker", async () => {
    const inbound = await dispatchMultitaskInbound({
      text: "What is the status?\n\nHave Lyra research ambient presence approaches.",
      sendTarget: { kind: "orchestrator" },
      workers,
      router: createHeuristicThoughtRouter(),
    });

    expect(inbound.mode).toBe("routed");
    expect(inbound.directThoughts.length).toBeGreaterThanOrEqual(1);
    expect(inbound.assignedGoals.some((g) => g.agentId === "agent-researcher")).toBe(true);
  });

  test("short greeting is answered by the orchestrator, not worker-only", async () => {
    const inbound = await dispatchMultitaskInbound({
      text: "hey",
      sendTarget: { kind: "orchestrator" },
      workers,
      router: createHeuristicThoughtRouter(),
    });

    expect(inbound.mode).toBe("routed");
    expect(inbound.directThoughts).toEqual(["hey"]);
    expect(inbound.assignedGoals).toHaveLength(0);
    expect(inbound.routing?.thoughts[0]?.disposition.kind).toBe("direct");
  });

  test("Jev misrouting a greeting is reclaimed as orchestrator-direct", async () => {
    const inbound = await dispatchMultitaskInbound({
      text: "hey",
      sendTarget: { kind: "orchestrator" },
      workers,
      router: createJevThoughtRouter({
        generate: async () => ({
          object: {
            thoughts: [
              {
                text: "hey",
                disposition: {
                  kind: "new_subagent",
                  suggestedRole: "generalist",
                  reason: "wrongly spawned",
                },
              },
            ],
          },
        }),
      }),
    });

    expect(inbound.directThoughts).toEqual(["hey"]);
    expect(inbound.assignedGoals).toHaveLength(0);
    expect(inbound.routing?.thoughts[0]?.disposition.kind).toBe("direct");
  });

  test("subagent-target still delivers a greeting to that worker only", async () => {
    const inbound = await dispatchMultitaskInbound({
      text: "hey",
      sendTarget: { kind: "subagent", agentId: "agent-coder" },
      workers,
      router: createHeuristicThoughtRouter(),
    });

    expect(inbound.mode).toBe("direct_to_subagent");
    expect(inbound.deliveredAgentId).toBe("agent-coder");
    expect(inbound.assignedGoals).toHaveLength(1);
    expect(inbound.directThoughts).toEqual([]);
  });

  test("task with no match spawns a new worker disposition", async () => {
    const router = createHeuristicThoughtRouter();
    const result = await router.route({
      text: "Implement a brand-new quantum compiler pipeline from scratch.",
      workers: [],
    });
    expect(result.thoughts[0]!.disposition.kind).toBe("new_subagent");
  });

  test("orchestrator-target runs the Jev splitter/router", async () => {
    const inbound = await dispatchMultitaskInbound({
      text: "Thanks.\n\nHave Reed implement the Speak-to mint path.",
      sendTarget: { kind: "orchestrator" },
      workers,
      router: createJevThoughtRouter({
        generate: async (args) => {
          expect(args.model).toBe("openai/gpt-6-jev");
          expect(args.providerOptions.gateway.zeroDataRetention).toBe(true);

          return {
            object: {
              thoughts: [
                {
                  text: "Thanks.",
                  disposition: { kind: "direct", reason: "ack" },
                },
                {
                  text: "Have Reed implement the Speak-to mint path.",
                  disposition: {
                    kind: "existing_subagent",
                    agentId: "agent-coder",
                    reason: "matched Reed",
                  },
                },
              ],
            },
          };
        },
      }),
    });
    expect(inbound.mode).toBe("routed");
    expect(inbound.sendTarget.kind).toBe("orchestrator");
    expect(inbound.routing?.routerModelId).toBe("openai/gpt-6-jev");
    expect(inbound.routing?.usedHeuristicFallback).toBe(false);
    expect(inbound.routing?.thoughts.length).toBe(2);
  });

  test("subagent-target delivers to that agent only and skips Jev split", async () => {
    let jevCalled = false;
    const inbound = await dispatchMultitaskInbound({
      text: "First do A.\n\nAlso research B and implement C.",
      sendTarget: { kind: "subagent", agentId: "agent-coder" },
      workers,
      router: createJevThoughtRouter({
        generate: async () => {
          jevCalled = true;
          throw new Error("should not be called for subagent target");
        },
      }),
    });

    expect(jevCalled).toBe(false);
    expect(inbound.mode).toBe("direct_to_subagent");
    expect(inbound.deliveredAgentId).toBe("agent-coder");
    expect(inbound.deliveredText).toContain("First do A");
    expect(inbound.routing).toBeUndefined();
    expect(inbound.assignedGoals).toHaveLength(1);
    expect(inbound.assignedGoals[0]!.agentId).toBe("agent-coder");
    expect(inbound.directThoughts).toEqual([]);
  });

  test("absent send target defaults to orchestrator routing via Jev", async () => {
    const inbound = await dispatchMultitaskInbound({
      text: "Can you confirm?",
      workers,
      router: createJevThoughtRouter({
        generate: async (args) => {
          expect(args.providerOptions.gateway.zeroDataRetention).toBe(true);

          return {
            object: {
              thoughts: [
                {
                  text: "Can you confirm?",
                  disposition: { kind: "direct", reason: "confirmation" },
                },
              ],
            },
          };
        },
      }),
    });
    expect(inbound.sendTarget.kind).toBe("orchestrator");
    expect(inbound.mode).toBe("routed");
    expect(inbound.routing?.routerModelId).toBe(JEV_GATEWAY_MODEL_ID);
  });
});

describe("executeAssignedWorkers + model runs", () => {
  test("routed thought invokes the worker model once with the turn model id", async () => {
    let modelCalls = 0;
    let seenModel: string | undefined;
    let seenPrompt: string | undefined;

    const inbound = await dispatchMultitaskInbound({
      text: "Thanks.\n\nHave Reed implement the Speak-to mint path.",
      sendTarget: { kind: "orchestrator" },
      workers,
      router: createJevThoughtRouter({
        generate: async () => ({
          object: {
            thoughts: [
              {
                text: "Thanks.",
                disposition: { kind: "direct", reason: "ack" },
              },
              {
                text: "Have Reed implement the Speak-to mint path.",
                disposition: {
                  kind: "existing_subagent",
                  agentId: "agent-coder",
                  reason: "matched Reed",
                },
              },
            ],
          },
        }),
      }),
    });

    expect(inbound.assignedGoals).toHaveLength(1);

    const bus = new OrchestratorAwarenessBus();
    const outcome = "Mint path accepts voice id and seeds goal progress.";

    const { results } = await executeAssignedWorkers({
      goals: inbound.assignedGoals,
      modelId: "openai/gpt-6-sol",
      workers,
      bus,
      generateText: async (args) => {
        modelCalls += 1;
        seenModel = args.model;
        seenPrompt = args.prompt;
        return { text: outcome };
      },
    });

    expect(modelCalls).toBe(1);
    expect(seenModel).toBe("openai/gpt-6-sol");
    expect(seenPrompt).toContain("Speak-to mint");
    expect(results).toHaveLength(1);
    expect(results[0]!.completed).toBe(true);

    const progressEvents = bus.list(inbound.assignedGoals[0]!.orchestratorId);
    const narratives = progressEvents
      .filter((e) => e.kind === "progress")
      .map((e) => (e.kind === "progress" ? e.narrative : ""));
    expect(narratives.some((n) => n.includes(outcome))).toBe(true);
    expect(narratives.every((n) => !n.includes("Waiting on shell QA"))).toBe(true);
    const pcts = progressEvents
      .filter((e) => e.kind === "progress")
      .map((e) => (e.kind === "progress" ? e.progressPct : -1));
    expect(pcts.includes(90)).toBe(false);
    expect(pcts.includes(95)).toBe(false);
  });

  test("subagent-target skips Jev and still runs the worker model once", async () => {
    let jevCalled = false;
    let workerCalls = 0;

    const inbound = await dispatchMultitaskInbound({
      text: "Ship the mint path end to end.",
      sendTarget: { kind: "subagent", agentId: "agent-coder" },
      workers,
      router: createJevThoughtRouter({
        generate: async () => {
          jevCalled = true;
          throw new Error("should not be called");
        },
      }),
    });

    expect(jevCalled).toBe(false);
    expect(inbound.assignedGoals).toHaveLength(1);

    await executeAssignedWorkers({
      goals: inbound.assignedGoals,
      modelId: DEFAULT_CHAT_MODEL.id,
      workers,
      generateText: async () => {
        workerCalls += 1;
        return { text: "Done: mint path ships." };
      },
    });

    expect(workerCalls).toBe(1);
  });

  test("worker failure surfaces as failure event, not a near-done percent", async () => {
    const bus = new OrchestratorAwarenessBus();
    const goal = {
      goalId: "g-fail",
      agentId: "agent-coder",
      goal: "Do the thing",
      assignedAt: 1,
      orchestratorId: "aion",
    };

    const result = await runWorkerGoalWithModel({
      goal,
      modelId: "openai/gpt-6-sol",
      bus,
      generateText: async () => {
        throw new Error("gateway 503");
      },
    });

    expect(result.completed).toBe(false);
    const events = bus.list("aion");
    expect(events.some((e) => e.kind === "failure")).toBe(true);
    expect(events.some((e) => e.kind === "completion")).toBe(false);

    const roster = createDemoSubagents();
    const reed = roster.find((a) => a.id === "agent-coder")!;
    const failure = events.find((e) => e.kind === "failure")!;
    const patched = applyWorkerAwarenessToSubagent(reed, failure);
    expect(patched.status).toBe("blocked");
    expect(patched.progress).toContain("gateway 503");
    expect(patched.progressPct).toBeLessThan(90);
  });
});

describe("identity images", () => {
  test("image prompt constraints reject human subjects", () => {
    const bad = assertNonHumanIdentitySubject("a portrait of a human face");
    expect(bad.ok).toBe(false);

    expect(() =>
      buildSubagentIdentityPrompt({
        name: "Reed",
        displayRole: "coder",
        runtimeRole: "worker",
        surfaceTraits: ["brushed metal", "human face"],
      })
    ).toThrow(/human/i);

    const prompt = buildSubagentIdentityPrompt({
      name: "Reed",
      displayRole: "coder",
      runtimeRole: "worker",
      surfaceTraits: ["brushed metal lattice", "cool teal refraction"],
    });
    expect(prompt).toContain("Abstract non-figurative");
    expect(assertNonHumanIdentitySubject("brushed metal lattice").ok).toBe(true);
  });

  test("stored identity image is reused", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "subagent-id-"));
    try {
      const blobStore = createLocalIdentityBlobStore({
        rootDir: path.join(root, "blobs"),
      });
      const metaStore = createLocalIdentityMetaStore({
        rootDir: path.join(root, "meta"),
      });
      let generateCalls = 0;

      const identity = {
        agentId: "agent-coder",
        name: "Reed",
        displayRole: "coder",
        runtimeRole: "worker" as const,
        surfaceTraits: ["copper lattice", "soft amber light"],
      };

      const first = await ensureSubagentIdentityImage(identity, {
        blobStore,
        metaStore,
        generate: async () => {
          generateCalls += 1;
          return {
            bytes: new Uint8Array([1, 2, 3, 4]),
            mediaType: "image/png",
            prompt: "abstract mark",
          };
        },
      });

      const second = await ensureSubagentIdentityImage(identity, {
        blobStore,
        metaStore,
        generate: async () => {
          generateCalls += 1;
          return {
            bytes: new Uint8Array([9, 9, 9]),
            mediaType: "image/png",
            prompt: "should not run",
          };
        },
      });

      expect(generateCalls).toBe(1);
      expect(second.url).toBe(first.url);
      expect(second.storageKey).toBe(first.storageKey);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
