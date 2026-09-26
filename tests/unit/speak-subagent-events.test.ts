import { describe, expect, test } from "bun:test";

import {
  buildSubagentMilestoneItem,
  formatSubagentMilestoneBody,
  SUBAGENT_MILESTONE_PREFACE,
} from "@/lib/speak/subagent-milestone-item";
import {
  buildSubagentProgressItem,
  formatSubagentProgressBody,
  SUBAGENT_PROGRESS_PREFACE,
} from "@/lib/speak/subagent-progress-item";

describe("subagent progress item (silent)", () => {
  test("builds a system item with the silent preface and no response.create", () => {
    const body = formatSubagentProgressBody({
      agentId: "agent-coder",
      name: "Reed",
      role: "coder",
      progress: "Session mint accepts voice.",
    });
    const item = buildSubagentProgressItem(body) as {
      type: string;
      item: { role: string; content: Array<{ text: string }> };
    };

    expect(item.type).toBe("conversation.item.create");
    expect(item.item.role).toBe("system");
    expect(item.item.content[0]!.text).toContain(SUBAGENT_PROGRESS_PREFACE);
    expect(item.item.content[0]!.text).toContain("Reed");
    expect(item.item.content[0]!.text).toContain("Session mint accepts voice.");
    expect(JSON.stringify(item)).not.toContain("response.create");
  });

  test("returns null for empty bodies", () => {
    expect(buildSubagentProgressItem("")).toBeNull();
    expect(buildSubagentProgressItem("  \n")).toBeNull();
  });
});

describe("subagent milestone item (announce)", () => {
  test("builds a system item with the announce preface", () => {
    const body = formatSubagentMilestoneBody({
      agentId: "agent-planner",
      name: "Mira",
      role: "planner",
      milestone: "Cut list accepted.",
      progress: "78%",
    });
    const item = buildSubagentMilestoneItem(body) as {
      type: string;
      item: { role: string; content: Array<{ text: string }> };
    };

    expect(item.type).toBe("conversation.item.create");
    expect(item.item.role).toBe("system");
    expect(item.item.content[0]!.text).toContain(SUBAGENT_MILESTONE_PREFACE);
    expect(item.item.content[0]!.text).toContain("Cut list accepted.");
    expect(item.item.content[0]!.text).toContain("78%");
  });

  test("returns null for empty bodies", () => {
    expect(buildSubagentMilestoneItem("")).toBeNull();
  });
});
