import { describe, expect, test } from "bun:test";
import { asSchema } from "ai";

import { createErgonTicketTools, ergonConfigForUser } from "@/lib/llm/ergon-ticket-tools";

const env = {
  ERGON_URL: "https://ergon.example.com",
  ERGON_TOKEN: "erg_test-only",
  ERGON_OWNER_PROFILE_ID: "owner-profile",
};
const options = { toolCallId: "test", messages: [] };

describe("connected Ergon tickets", () => {
  test("denies every other profile and incomplete configuration before making a request", () => {
    expect(createErgonTicketTools("stranger", { env })).toEqual({});
    expect(createErgonTicketTools("", { env })).toEqual({});
    for (const key of Object.keys(env)) {
      expect(createErgonTicketTools("owner-profile", { env: { ...env, [key]: "" } })).toEqual({});
    }
    expect(ergonConfigForUser("owner-profile", { ...env, ERGON_OWNER_PROFILE_ID: "*" })).toBeNull();
  });

  test("requires HTTPS except for loopback development and rejects credentials or query strings in the URL", () => {
    for (const url of [
      "http://ergon.example.com",
      "https://secret@ergon.example.com",
      "https://ergon.example.com/?token=secret",
      "https://ergon.example.com/mcp",
      "invalid",
    ]) {
      expect(ergonConfigForUser("owner-profile", { ...env, ERGON_URL: url })).toBeNull();
    }
    expect(
      ergonConfigForUser("owner-profile", { ...env, ERGON_URL: "http://127.0.0.1:4600" })?.url
    ).toBe("http://127.0.0.1:4600");
  });

  test("sends authenticated bounded requests to the existing Ergon API and returns real identifiers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const tools = createErgonTicketTools("owner-profile", {
      env,
      fetch: async (url, init) => {
        calls.push({ url, init });
        const issue = { id: "COA-258", title: "Ship the bridge", url: "/issue/COA-258" };
        return Response.json(
          url.endsWith("/list_issues") ? { issues: [issue], hasNextPage: false } : issue
        );
      },
    });

    expect(Object.keys(tools)).toHaveLength(7);
    const created = await tools.ergon_save_issue!.execute!({ title: "Ship the bridge" }, options);
    expect(created).toMatchObject({
      id: "COA-258",
      url: "https://ergon.example.com/issue/COA-258",
    });
    expect(calls[0].url).toBe("https://ergon.example.com/api/rpc/save_issue");
    expect(calls[0].init.headers).toMatchObject({ authorization: "Bearer erg_test-only" });
    expect(calls[0].init.cache).toBe("no-store");
    expect(calls[0].init.redirect).toBe("error");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ title: "Ship the bridge" });

    await tools.ergon_list_issues!.execute!({ limit: 900 }, options);
    expect(JSON.parse(calls[1].init.body as string).limit).toBe(100);
    await tools.ergon_get_issue!.execute!({ id: "COA-258" }, options);
    expect(JSON.parse(calls[2].init.body as string)).toEqual({
      id: "COA-258",
      includeComments: true,
    });
    await tools.ergon_save_comment!.execute!(
      { issueId: "COA-258", body: "Codex and Organic share this ticket." },
      options
    );
    expect(calls[3].url).toEndWith("/api/rpc/save_comment");
    await tools.ergon_save_issue!.execute!({ id: "COA-258", state: "Done" }, options);
    expect(JSON.parse(calls[4].init.body as string)).toEqual({ id: "COA-258", state: "Done" });
    await tools.ergon_list_projects!.execute!({}, options);
    await tools.ergon_list_issue_statuses!.execute!({}, options);
    await tools.ergon_list_issue_labels!.execute!({}, options);
    expect(calls.slice(5).map((call) => call.url.split("/").at(-1))).toEqual([
      "list_projects",
      "list_issue_statuses",
      "list_issue_labels",
    ]);
  });

  test("does not leak tokens, upstream response bodies, or retry an unconfirmed mutation", async () => {
    let calls = 0;
    const tools = createErgonTicketTools("owner-profile", {
      env,
      fetch: async () => {
        calls++;
        throw new Error(`Connection failed with ${env.ERGON_TOKEN}`);
      },
    });
    const result = await tools.ergon_save_issue!.execute!({ title: "Ship" }, options);
    expect(calls).toBe(1);
    expect(JSON.stringify(result)).not.toContain(env.ERGON_TOKEN);
    expect(result).toMatchObject({ error: expect.stringContaining("before retrying") });

    const rejected = createErgonTicketTools("owner-profile", {
      env,
      fetch: async () => new Response(env.ERGON_TOKEN, { status: 403 }),
    });
    expect(await rejected.ergon_list_issues!.execute!({}, options)).toEqual({
      error: "Ergon returned HTTP 403. Check the ticket before retrying a write.",
    });
  });

  test("clears only explicitly named fields and preserves supplied zero and empty values", async () => {
    const bodies: unknown[] = [];
    const tools = createErgonTicketTools("owner-profile", {
      env,
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(init.body as string));
        return Response.json({ id: "COA-258" });
      },
    });

    await tools.ergon_save_issue!.execute!(
      { id: "COA-258", description: "", estMinutes: 0, clearFields: ["assignee"] },
      options
    );
    expect(bodies[0]).toEqual({ id: "COA-258", description: "", estMinutes: 0, assignee: null });

    await tools.ergon_save_issue!.execute!(
      {
        id: "COA-258",
        clearFields: [
          "description",
          "project",
          "assignee",
          "parentId",
          "dueDate",
          "plannedAt",
          "estMinutes",
        ],
      },
      options
    );
    expect(bodies[1]).toEqual({
      id: "COA-258",
      description: null,
      project: null,
      assignee: null,
      parentId: null,
      dueDate: null,
      plannedAt: null,
      estMinutes: null,
    });

    await tools.ergon_save_issue!.execute!({ id: "COA-258", clearFields: [] }, options);
    expect(bodies[2]).toEqual({ id: "COA-258" });
  });

  test("rejects setting and clearing the same field before making a request", async () => {
    let calls = 0;
    const tools = createErgonTicketTools("owner-profile", {
      env,
      fetch: async () => {
        calls++;
        return Response.json({});
      },
    });

    for (const value of [0, 30]) {
      expect(
        await tools.ergon_save_issue!.execute!(
          { id: "COA-258", estMinutes: value, clearFields: ["estMinutes"] },
          options
        )
      ).toEqual({ error: "Cannot set and clear estMinutes in the same request." });
    }
    expect(calls).toBe(0);
  });

  test("validates the clearing vocabulary without nullable model inputs", async () => {
    const tools = createErgonTicketTools("owner-profile", { env });
    const schema = asSchema(tools.ergon_save_issue!.inputSchema);

    expect((await schema.validate!({ id: "COA-258", clearFields: ["assignee"] })).success).toBe(
      true
    );
    for (const invalid of [
      { id: "COA-258", clearFields: ["title"] },
      { id: "COA-258", clearFields: ["token"] },
      { id: "COA-258", assignee: null },
      { id: "COA-258", estMinutes: null },
    ]) {
      expect((await schema.validate!(invalid)).success).toBe(false);
    }

    // These declarations are what the AI SDK sends to the provider, not Zod internals.
    for (const definition of Object.values(tools)) {
      const serialized = JSON.stringify(await asSchema(definition.inputSchema).jsonSchema);
      expect(serialized).not.toContain('"anyOf"');
      expect(serialized).not.toContain('"oneOf"');
      expect(serialized).not.toContain('"null"');
    }
  });

  test("rejects empty writes and rechecks the configured owner when executing", async () => {
    let calls = 0;
    const config = { ...env };
    const tools = createErgonTicketTools("owner-profile", {
      env: config,
      fetch: async () => {
        calls++;
        return Response.json({});
      },
    });
    expect(await tools.ergon_save_issue!.execute!({}, options)).toHaveProperty("error");
    expect(
      await tools.ergon_save_comment!.execute!({ issueId: "COA-1", body: " " }, options)
    ).toHaveProperty("error");
    config.ERGON_OWNER_PROFILE_ID = "someone-else";
    expect(await tools.ergon_get_issue!.execute!({ id: "COA-1" }, options)).toHaveProperty("error");
    expect(calls).toBe(0);
  });
});
