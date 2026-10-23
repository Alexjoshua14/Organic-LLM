import { describe, expect, test } from "bun:test";
import { asSchema } from "ai";

import { createErgonTicketTools, ergonConfigForUser } from "@/lib/llm/ergon-ticket-tools";

const env = {
  ERGON_URL: "https://ergon.example.com",
  ERGON_TOKEN: "erg_test-only",
  ERGON_OWNER_PROFILE_ID: "owner-profile",
};
const options = { toolCallId: "test", messages: [] };
const noUserConnection = {
  loadConnection: async () => null,
  resolveToken: async () => null,
};

describe("connected Ergon tickets", () => {
  test("denies every other profile and incomplete configuration before making a request", async () => {
    expect(await createErgonTicketTools("stranger", { env, ...noUserConnection })).toEqual({});
    expect(await createErgonTicketTools("", { env, ...noUserConnection })).toEqual({});
    for (const key of Object.keys(env)) {
      expect(
        await createErgonTicketTools("owner-profile", {
          env: { ...env, [key]: "" },
          ...noUserConnection,
        })
      ).toEqual({});
    }
    expect(
      await ergonConfigForUser("owner-profile", "tickets", {
        env: { ...env, ERGON_OWNER_PROFILE_ID: "*" },
        ...noUserConnection,
      })
    ).toBeNull();
  });

  test("requires HTTPS except for loopback development and rejects credentials or query strings in the URL", async () => {
    for (const url of [
      "http://ergon.example.com",
      "https://secret@ergon.example.com",
      "https://ergon.example.com/?token=secret",
      "https://ergon.example.com/mcp",
      "invalid",
    ]) {
      expect(
        await ergonConfigForUser("owner-profile", "tickets", {
          env: { ...env, ERGON_URL: url },
          ...noUserConnection,
        })
      ).toBeNull();
    }
    expect(
      (
        await ergonConfigForUser("owner-profile", "tickets", {
          env: { ...env, ERGON_URL: "http://127.0.0.1:4600" },
          ...noUserConnection,
        })
      )?.url
    ).toBe("http://127.0.0.1:4600");
  });

  test("sends authenticated bounded requests to the existing Ergon API and returns real identifiers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const tools = await createErgonTicketTools("owner-profile", {
      env,
      ...noUserConnection,
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
    const tools = await createErgonTicketTools("owner-profile", {
      env,
      ...noUserConnection,
      fetch: async () => {
        calls++;
        throw new Error(`Connection failed with ${env.ERGON_TOKEN}`);
      },
    });
    const result = await tools.ergon_save_issue!.execute!({ title: "Ship" }, options);

    expect(calls).toBe(1);
    expect(JSON.stringify(result)).not.toContain(env.ERGON_TOKEN);

    const rejected = await createErgonTicketTools("owner-profile", {
      env,
      ...noUserConnection,
      fetch: async () => new Response(env.ERGON_TOKEN, { status: 403 }),
    });
    const denied = await rejected.ergon_list_issues!.execute!({}, options);

    expect(JSON.stringify(denied)).not.toContain(env.ERGON_TOKEN);
  });

  test("clears only explicitly named fields and preserves supplied zero and empty values", async () => {
    const bodies: unknown[] = [];
    const tools = await createErgonTicketTools("owner-profile", {
      env,
      ...noUserConnection,
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(init.body as string));
        return Response.json({ id: "COA-258" });
      },
    });

    await tools.ergon_save_issue!.execute!(
      { id: "COA-258", description: "", clearFields: ["assignee"] },
      options
    );
    expect(bodies[0]).toEqual({ id: "COA-258", description: "", assignee: null });

    await tools.ergon_save_issue!.execute!(
      { id: "COA-258", estMinutes: 0, clearFields: ["description", "dueDate"] },
      options
    );
    expect(bodies[1]).toEqual({
      id: "COA-258",
      estMinutes: 0,
      description: null,
      dueDate: null,
    });

    await tools.ergon_save_issue!.execute!({ id: "COA-258", clearFields: [] }, options);
    expect(bodies[2]).toEqual({ id: "COA-258" });
  });

  test("rejects setting and clearing the same field before making a request", async () => {
    let calls = 0;
    const tools = await createErgonTicketTools("owner-profile", {
      env,
      ...noUserConnection,
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
      ).toHaveProperty("error");
    }
    expect(calls).toBe(0);
  });

  test("validates the clearing vocabulary without nullable model inputs", async () => {
    const tools = await createErgonTicketTools("owner-profile", { env, ...noUserConnection });
    const schema = asSchema(tools.ergon_save_issue!.inputSchema);
    const json = await schema.jsonSchema;

    expect(JSON.stringify(json)).not.toContain("nullable");
  });

  test("rejects empty writes before making a request", async () => {
    let calls = 0;
    const tools = await createErgonTicketTools("owner-profile", {
      env,
      ...noUserConnection,
      fetch: async () => {
        calls++;
        return Response.json({});
      },
    });
    expect(await tools.ergon_save_issue!.execute!({}, options)).toHaveProperty("error");
    expect(
      await tools.ergon_save_comment!.execute!({ issueId: "COA-1", body: " " }, options)
    ).toHaveProperty("error");
    expect(calls).toBe(0);
  });
});
