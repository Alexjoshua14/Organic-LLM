import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { asSchema } from "ai";

import { createErgonTicketTools, ergonConfigForUser } from "@/lib/llm/ergon-ticket-tools";
import {
  ERGON_TEST_OWNER,
  ERGON_TEST_STRANGER,
  installConnectedErgon,
  recordingErgonCalls,
  uninstallConnectedErgon,
} from "../helpers/ergon-connected";

const TOKEN = "oauth_access_ticket_test";
const options = { toolCallId: "test", messages: [] };

beforeEach(async () => {
  await installConnectedErgon({ token: TOKEN });
});
afterEach(uninstallConnectedErgon);

describe("connected Ergon tickets", () => {
  test("denies every profile without its own connection and any connection without write scope", async () => {
    expect(await createErgonTicketTools(ERGON_TEST_STRANGER)).toEqual({});
    expect(await createErgonTicketTools("")).toEqual({});
    expect(await createErgonTicketTools("*")).toEqual({});

    await installConnectedErgon({ scopes: ["read"] });
    expect(await createErgonTicketTools(ERGON_TEST_OWNER)).toEqual({});
  });

  test("requires HTTPS except for loopback development and rejects credentials or query strings in the URL", async () => {
    for (const url of [
      "http://ergon.example.com",
      "https://secret@ergon.example.com",
      "https://ergon.example.com/?token=secret",
      "https://ergon.example.com/mcp",
      "invalid",
    ]) {
      await installConnectedErgon({ url });
      expect(await ergonConfigForUser(ERGON_TEST_OWNER, "tickets")).toBeNull();
    }

    await installConnectedErgon({ url: "http://127.0.0.1:4600" });
    expect((await ergonConfigForUser(ERGON_TEST_OWNER, "tickets"))?.url).toBe(
      "http://127.0.0.1:4600"
    );
  });

  test("calls Ergon as the connected user with bounded input and returns real identifiers", async () => {
    const { calls, callTool } = recordingErgonCalls((name) => {
      const issue = { id: "COA-258", title: "Ship the bridge", url: "/issue/COA-258" };

      return name === "list_issues" ? { issues: [issue], hasNextPage: false } : issue;
    });
    const tools = await createErgonTicketTools(ERGON_TEST_OWNER, { callTool });

    expect(Object.keys(tools)).toHaveLength(7);
    const created = await tools.ergon_save_issue!.execute!({ title: "Ship the bridge" }, options);

    expect(created).toMatchObject({
      id: "COA-258",
      url: "https://ergon.example.com/issue/COA-258",
    });
    // The user's own OAuth access token, against Ergon's MCP endpoint, and nothing else.
    expect(calls[0]).toMatchObject({
      name: "save_issue",
      token: TOKEN,
      mcpUrl: "https://ergon.example.com/mcp",
      input: { title: "Ship the bridge" },
    });

    await tools.ergon_list_issues!.execute!({ limit: 900 }, options);
    expect((calls[1].input as { limit: number }).limit).toBe(100);
    await tools.ergon_get_issue!.execute!({ id: "COA-258" }, options);
    expect(calls[2].input).toEqual({ id: "COA-258", includeComments: true });
    await tools.ergon_save_comment!.execute!(
      { issueId: "COA-258", body: "Codex and Organic share this ticket." },
      options
    );
    expect(calls[3].name).toBe("save_comment");
    await tools.ergon_save_issue!.execute!({ id: "COA-258", state: "Done" }, options);
    expect(calls[4].input).toEqual({ id: "COA-258", state: "Done" });
    await tools.ergon_list_projects!.execute!({}, options);
    await tools.ergon_list_issue_statuses!.execute!({}, options);
    await tools.ergon_list_issue_labels!.execute!({}, options);
    expect(calls.slice(5).map((call) => call.name)).toEqual([
      "list_projects",
      "list_issue_statuses",
      "list_issue_labels",
    ]);
    expect(new Set(calls.map((call) => call.token))).toEqual(new Set([TOKEN]));
  });

  test("does not leak tokens or retry an unconfirmed mutation", async () => {
    let calls = 0;
    const tools = await createErgonTicketTools(ERGON_TEST_OWNER, {
      callTool: async () => {
        calls++;
        throw new Error(`Connection failed with ${TOKEN}`);
      },
    });
    const result = await tools.ergon_save_issue!.execute!({ title: "Ship" }, options);

    expect(calls).toBe(1);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  test("clears only explicitly named fields and preserves supplied zero and empty values", async () => {
    const { calls, callTool } = recordingErgonCalls(() => ({ id: "COA-258" }));
    const tools = await createErgonTicketTools(ERGON_TEST_OWNER, { callTool });

    await tools.ergon_save_issue!.execute!(
      { id: "COA-258", description: "", clearFields: ["assignee"] },
      options
    );
    expect(calls[0].input).toEqual({ id: "COA-258", description: "", assignee: null });

    await tools.ergon_save_issue!.execute!(
      { id: "COA-258", estMinutes: 0, clearFields: ["description", "dueDate"] },
      options
    );
    expect(calls[1].input).toEqual({
      id: "COA-258",
      estMinutes: 0,
      description: null,
      dueDate: null,
    });

    await tools.ergon_save_issue!.execute!({ id: "COA-258", clearFields: [] }, options);
    expect(calls[2].input).toEqual({ id: "COA-258" });
  });

  test("rejects setting and clearing the same field before making a request", async () => {
    const { calls, callTool } = recordingErgonCalls();
    const tools = await createErgonTicketTools(ERGON_TEST_OWNER, { callTool });

    for (const value of [0, 30]) {
      expect(
        await tools.ergon_save_issue!.execute!(
          { id: "COA-258", estMinutes: value, clearFields: ["estMinutes"] },
          options
        )
      ).toHaveProperty("error");
    }
    expect(calls).toHaveLength(0);
  });

  test("validates the clearing vocabulary without nullable model inputs", async () => {
    const tools = await createErgonTicketTools(ERGON_TEST_OWNER);
    const schema = asSchema(tools.ergon_save_issue!.inputSchema);
    const json = await schema.jsonSchema;

    expect(JSON.stringify(json)).not.toContain("nullable");
  });

  test("rejects empty writes before making a request", async () => {
    const { calls, callTool } = recordingErgonCalls();
    const tools = await createErgonTicketTools(ERGON_TEST_OWNER, { callTool });

    expect(await tools.ergon_save_issue!.execute!({}, options)).toHaveProperty("error");
    expect(
      await tools.ergon_save_comment!.execute!({ issueId: "COA-1", body: " " }, options)
    ).toHaveProperty("error");
    expect(calls).toHaveLength(0);
  });
});
