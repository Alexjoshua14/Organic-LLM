import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { compileSpeakRealtimeTools, isToolAllowedForSession } from "@/lib/llm/compile-speak-tools";
import { ergonToolsAvailable } from "@/lib/llm/ergon-config";
import { readSpeakErgon } from "@/lib/speak/ergon-read";
import {
  ERGON_TEST_OWNER,
  ERGON_TEST_STRANGER,
  installConnectedErgon,
  recordingErgonCalls,
  uninstallConnectedErgon,
} from "../helpers/ergon-connected";

const voiceOnly = { text: false, genUi: false, web: false };

beforeEach(async () => {
  await installConnectedErgon();
});
afterEach(uninstallConnectedErgon);

describe("Speak connected Ergon reads", () => {
  test("registers for connected ordinary voice independently of visual toggles", async () => {
    const ergonEnabled = await ergonToolsAvailable(ERGON_TEST_OWNER, "reads");
    const tools = compileSpeakRealtimeTools(voiceOnly, { ergonEnabled });

    expect(tools.some((tool) => tool.name === "read_ergon")).toBe(true);
    expect(tools.find((tool) => tool.name === "read_ergon")?.parameters.type).toBe("object");
    expect(tools.find((tool) => tool.name === "read_ergon")?.description).toContain(
      "list_projects immediately"
    );
    expect(compileSpeakRealtimeTools(voiceOnly).some((t) => t.name === "read_ergon")).toBe(false);
    expect(
      compileSpeakRealtimeTools(voiceOnly, { ergonEnabled, stage: true }).some(
        (t) => t.name === "read_ergon"
      )
    ).toBe(false);
    expect(
      isToolAllowedForSession("read_ergon", { modalities: voiceOnly, memoryEnabled: false })
    ).toBe(true);
    expect(
      isToolAllowedForSession("read_ergon", {
        modalities: voiceOnly,
        memoryEnabled: false,
        stage: true,
      })
    ).toBe(false);
  });

  test("read purpose accepts read-only or write scope, not agents-only", async () => {
    await installConnectedErgon({ scopes: ["read"] });
    expect(await ergonToolsAvailable(ERGON_TEST_OWNER, "reads")).toBe(true);

    await installConnectedErgon({ scopes: ["write"] });
    expect(await ergonToolsAvailable(ERGON_TEST_OWNER, "reads")).toBe(true);

    await installConnectedErgon({ scopes: ["agents"] });
    expect(await ergonToolsAvailable(ERGON_TEST_OWNER, "reads")).toBe(false);
  });

  test("looks up the named project then its tickets as the connected owner", async () => {
    const { calls, callTool } = recordingErgonCalls((name) =>
      name === "get_project"
        ? { id: "P-COA-99", name: "Example project" }
        : { issues: [{ id: "COA-999", title: "Example task" }] }
    );

    expect(
      await readSpeakErgon(
        ERGON_TEST_OWNER,
        { action: "get_project", query: "Example project" },
        { callTool }
      )
    ).toMatchObject({ id: "P-COA-99" });
    await readSpeakErgon(
      ERGON_TEST_OWNER,
      { action: "list_issues", project: "P-COA-99" },
      { callTool }
    );
    expect(calls.map(({ name, input }) => ({ name, input }))).toEqual([
      { name: "get_project", input: { query: "Example project" } },
      { name: "list_issues", input: { project: "P-COA-99", limit: 10 } },
    ]);
    expect(calls[0]).toMatchObject({
      token: "oauth_access_test",
      mcpUrl: "https://ergon.example.com/mcp",
    });
  });

  test("denies other profiles and rechecks access after a disconnect", async () => {
    const { calls, callTool } = recordingErgonCalls();
    const input = { action: "list_projects" };

    expect(await readSpeakErgon(ERGON_TEST_STRANGER, input, { callTool })).toHaveProperty("error");
    // A different owner's connection replaces the old one, simulating revoked access.
    await installConnectedErgon({ owner: ERGON_TEST_STRANGER });
    expect(await readSpeakErgon(ERGON_TEST_OWNER, input, { callTool })).toHaveProperty("error");
    expect(calls).toHaveLength(0);
  });

  test("rejects writes, missing selectors and oversized queries before calling Ergon", async () => {
    const { calls, callTool } = recordingErgonCalls();

    for (const input of [
      { action: "save_issue", title: "Should not run" },
      { action: "get_project" },
      { action: "list_issues" },
      { action: "get_issue", id: "" },
      { action: "get_project", query: "x".repeat(201) },
    ]) {
      expect(await readSpeakErgon(ERGON_TEST_OWNER, input, { callTool })).toHaveProperty("error");
    }
    expect(calls).toHaveLength(0);
  });

  test("returns lookup failures without inventing results or exposing thrown details", async () => {
    const { callTool } = recordingErgonCalls(() => {
      throw new Error("private transport detail");
    });
    const result = await readSpeakErgon(
      ERGON_TEST_OWNER,
      { action: "list_projects" },
      { callTool }
    );

    expect(result).toEqual({ error: "Ergon could not be read right now. Try again shortly." });
  });
});
