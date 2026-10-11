import { expect, test } from "bun:test";

import { createSubagentActivitySeed } from "@/lib/arcadia/multitask/activity-seed";
import {
  applyAssignedGoalsToRoster,
  applyWorkerAwarenessToSubagent,
} from "@/lib/arcadia/multitask/apply-awareness";
import { mergeSubagentBoard, type SubagentBoardEntry } from "@/lib/arcadia/multitask/board-sync";
import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";

test("starting context produces deterministic distinct seeds, including same-name agents", () => {
  const agent = createDemoSubagents()[0]!;
  const seed = createSubagentActivitySeed(agent);

  expect(seed).toBe(createSubagentActivitySeed({ ...agent }));
  for (const field of ["id", "name", "role", "blurb", "goal"] as const) {
    expect(createSubagentActivitySeed({ ...agent, [field]: `${agent[field]} changed` })).not.toBe(
      seed
    );
  }
  expect(createSubagentActivitySeed({ ...agent, goal: "Research 🌱" })).not.toBe(
    createSubagentActivitySeed({ ...agent, goal: "Research 🌿" })
  );
  const roster = createDemoSubagents();
  expect(new Set(roster.map((entry) => entry.activitySeed)).size).toBe(roster.length);
  expect(roster.map((entry) => entry.activitySeed)).toEqual(
    createDemoSubagents().map((entry) => entry.activitySeed)
  );
});

test("assignments and live awareness preserve the captured starting seed", () => {
  const agent = createDemoSubagents()[0]!;
  const [assigned] = applyAssignedGoalsToRoster([agent], [{ agentId: agent.id, goal: "Review" }]);
  const updated = applyWorkerAwarenessToSubagent(assigned!, {
    kind: "progress",
    goalId: "review",
    agentId: agent.id,
    narrative: "Reading sources",
    assignedGoal: "Review the architecture",
    progressPct: 60,
    at: 1,
  });

  expect(assigned!.activitySeed).toBe(agent.activitySeed);
  expect(updated.activitySeed).toBe(agent.activitySeed);
  expect(createSubagentActivitySeed(updated)).not.toBe(updated.activitySeed!);
});

test("new board workers snapshot their initial goal once; legacy agents acquire a stable seed", () => {
  const entry: SubagentBoardEntry = {
    agentId: "worker-analyst-12345678",
    threadId: "child-thread",
    name: "Analyst",
    role: "analyst",
    goal: "Review architecture",
    status: "working",
    statusAt: null,
    outcome: null,
  };
  const [created] = mergeSubagentBoard([], [entry]);
  expect(created!.activitySeed).toBe(createSubagentActivitySeed(created!));
  const completedEntry = { ...entry, goal: "Write the conclusion", status: "done" as const };
  const [completed] = mergeSubagentBoard([created!], [completedEntry]);
  expect(completed!.activitySeed).toBe(created!.activitySeed);
  expect(mergeSubagentBoard([completed!], [completedEntry])[0]).toBe(completed);

  const { activitySeed: _seed, ...legacy } = createDemoSubagents()[0]!;
  const [backfilled] = mergeSubagentBoard([legacy], [{ ...entry, agentId: legacy.id }]);
  expect(backfilled!.activitySeed).toBe(createSubagentActivitySeed(legacy));
  expect(backfilled!.goal).toBe(entry.goal!);
});
