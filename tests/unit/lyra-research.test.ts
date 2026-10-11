import type { ResearchLedgerStore, RetrievedSource } from "@/lib/llm/subagents/research/ledger";

import { describe, expect, mock, test } from "bun:test";

import { getHardSetSubagent } from "@/lib/llm/subagents/hard-set/registry";
import { formatOrchestratorFragment } from "@/lib/llm/subagents/orchestrator/format-orchestrator-fragment";
import { resolveDispatchTarget } from "@/lib/llm/subagents/orchestrator/orchestrator-tools";
import {
  auditResearchLedger,
  captureSources,
  createResearchLedgerSession,
  emptyResearchLedger,
  recordClaim,
} from "@/lib/llm/subagents/research/ledger";
import { createResearchProviders } from "@/lib/llm/subagents/research/providers";
import { createResearchTools, ResearchCrawlInputSchema } from "@/lib/llm/subagents/research/tools";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { asSchema, convertToModelMessages } from "ai";
import { researchToolParts } from "@/lib/llm/subagents/worker/research-tool-parts";
import { runSubagentThreadTurn } from "@/lib/llm/subagents/worker/run-in-thread";
import { buildSubagentReplyMessage } from "@/lib/llm/subagents/threads/messages";
import { readResearchSource } from "@/lib/llm/subagents/research/presentation";

const NOW = "2026-10-10T12:00:00.000Z";
const URL = "https://example.com/report";
const CALL = { toolCallId: "test-call", messages: [] };
function memoryStore() {
  let ledger = emptyResearchLedger();
  let revision: string | null = null;
  let writes = 0;
  const store: ResearchLedgerStore = {
    load: async () => ({ ledger: structuredClone(ledger), revision }),
    save: async (next, previous) => {
      if (previous !== revision) return { status: "conflict" };
      ledger = structuredClone(next);
      revision = `r${++writes}`;
      return { status: "saved", revision };
    },
  };
  return { store, read: () => ledger };
}
function source(text = "The study included 120 participants."): RetrievedSource {
  return {
    url: URL,
    title: "Report",
    provider: "exa",
    text,
    publishedAt: null,
    locations: [],
    excerptOnly: false,
    truncated: false,
  };
}
const fakeProviders = (fetcher: typeof fetch) =>
  createResearchProviders({
    exaKey: "test-exa",
    firecrawlKey: "test-firecrawl",
    doclingUrl: "https://docling.example",
    doclingKey: "test-docling",
    fetch: fetcher,
    validateUrl: async (url) => url,
  });

describe("Lyra identity and toolbox", () => {
  test("every tool serializes to an explicit JSON object schema for model-provider compatibility", async () => {
    const tools = createResearchTools({ threadId: "thread", ownerId: "owner" });
    for (const [name, definition] of Object.entries(tools)) {
      const schema = await asSchema(definition.inputSchema).jsonSchema;
      expect({ name, type: schema.type }).toEqual({ name, type: "object" });
    }
    expect(ResearchCrawlInputSchema.safeParse({ action: "start" }).success).toBe(false);
    expect(ResearchCrawlInputSchema.safeParse({ action: "status" }).success).toBe(false);
    expect(ResearchCrawlInputSchema.safeParse({ action: "cancel" }).success).toBe(false);
    expect(ResearchCrawlInputSchema.safeParse({ action: "start", url: URL }).success).toBe(true);
    expect(ResearchCrawlInputSchema.safeParse({ action: "status", jobId: "job" }).success).toBe(
      true
    );
    expect(ResearchCrawlInputSchema.safeParse({ action: "cancel", jobId: "job" }).success).toBe(
      true
    );
  });
  test("refines the existing slot without duplicating Lyra on the orchestrator's roster", () => {
    const lyra = getHardSetSubagent("agent-researcher")!;
    expect(lyra.name).toBe("Lyra");
    expect(lyra.tools.research).toBe(true);
    expect(getHardSetSubagent("subagent-researcher")).toBe(lyra);
    for (const target of ["Lyra", "researcher", "agent-researcher", "subagent-researcher"])
      expect(resolveDispatchTarget(target, [])).toBe("agent-researcher");
    const fragment = formatOrchestratorFragment({
      snapshots: [],
      autonomous: false,
      autonomousRemaining: null,
    });
    expect(fragment.match(/Lyra \(/g)).toHaveLength(1);
    expect(fragment).toContain("agentId=agent-researcher");
  });

  test("research compilation provides dedicated tools and thread history without unrelated task tools", async () => {
    const compiled = await compileChatTools({
      useResearch: true,
      useSearch: true,
      useMemory: false,
      useGetMoreMessages: true,
      chatId: "thread",
      initialMessageCount: 1,
      sbUserId: "owner",
      experience: "arcadia",
    });
    for (const name of [
      "research_search",
      "research_read",
      "research_scrape",
      "research_map",
      "research_crawl",
      "research_parse_document",
      "research_source",
      "research_record_claim",
      "research_audit",
      "research_publish",
      "get_more_chat_history",
    ])
      expect(compiled.tools[name]).toBeDefined();
    expect(compiled.tools.manage_tasks).toBeUndefined();
    expect(compiled.tools.web_search).toBeUndefined();
    expect(compiled.toolInstructions).toContain("not truth");
  });
});

describe("evidence ledger", () => {
  test("keeps old snapshots intact when a source changes, and deduplicates repeated reads", () => {
    const first = captureSources(emptyResearchLedger(), [source()], NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const repeated = captureSources(first.ledger, [source()], NOW);
    expect(repeated.ok && repeated.ledger.sources.length).toBe(1);
    const changed = captureSources(
      first.ledger,
      [source("The study included 180 participants.")],
      NOW
    );
    expect(changed.ok && changed.ledger.sources.length).toBe(2);
    if (!changed.ok) return;
    expect(changed.ledger.sources[0]!.text).toContain("120");
    expect(changed.ledger.sources[0]!.sha256).not.toBe(changed.ledger.sources[1]!.sha256);
  });

  test("rejects invented quotations, unknown sources and incorrect page provenance", () => {
    const captured = captureSources(
      emptyResearchLedger(),
      [
        {
          ...source(),
          provider: "docling",
          locations: [{ page: 2, text: "The study included 120 participants." }],
        },
      ],
      NOW
    );
    if (!captured.ok) throw new Error("Fixture failed");
    const id = captured.value[0]!.id;
    const claim = (sourceId: string, quote: string, page?: number) =>
      recordClaim(
        captured.ledger,
        {
          statement: "The sample was 120.",
          assessment: "",
          evidence: [{ sourceId, quote, relation: "supports", page }],
        },
        NOW
      );
    expect(claim("unknown", "The study included 120 participants.").ok).toBe(false);
    expect(claim(id, "The study included 999 participants.").ok).toBe(false);
    expect(claim(id, "The study included 120 participants.", 1).ok).toBe(false);
    expect(claim(id, "The study included   120 participants.", 2).ok).toBe(true);
  });

  test("audits contradictions, excerpt-only evidence and unsupported claims without claiming truth", () => {
    const captured = captureSources(
      emptyResearchLedger(),
      [{ ...source(), excerptOnly: true, truncated: true }],
      NOW
    );
    if (!captured.ok) throw new Error("Fixture failed");
    const id = captured.value[0]!.id;
    const recorded = recordClaim(
      captured.ledger,
      {
        statement: "A contested finding",
        assessment: "Needs a full source read.",
        evidence: [
          { sourceId: id, quote: "The study included 120 participants.", relation: "supports" },
          { sourceId: id, quote: "The study included 120 participants.", relation: "contradicts" },
        ],
      },
      NOW
    );
    if (!recorded.ok) throw new Error("Fixture failed");
    const unsupported = recordClaim(
      recorded.ledger,
      { statement: "A hypothesis", assessment: "Unverified", evidence: [] },
      NOW
    );
    if (!unsupported.ok) throw new Error("Fixture failed");
    const audit = auditResearchLedger(unsupported.ledger);
    expect(audit.claims[0]!.issues).toEqual([
      "contradictory_evidence",
      "search_excerpt_only",
      "partial_source",
    ]);
    expect(audit.claims[0]!.supportingSourceCount).toBe(1);
    expect(audit.claims[1]!.issues).toContain("no_supporting_evidence");
    expect(audit.note).toContain("does not establish truth");
  });

  test("serializes parallel tools and reapplies changes after another request wins the revision", async () => {
    const state = memoryStore();
    let collided = false;
    const store: ResearchLedgerStore = {
      ...state.store,
      save: async (ledger, revision) => {
        if (!collided) {
          collided = true;
          const outside = captureSources(
            emptyResearchLedger(),
            [source("External request's result.")],
            NOW
          );
          if (outside.ok) await state.store.save(outside.ledger, null);
        }
        return state.store.save(ledger, revision);
      },
    };
    const session = createResearchLedgerSession(store);
    await Promise.all([
      session.mutate((ledger) => captureSources(ledger, [source("First parallel result.")], NOW)),
      session.mutate((ledger) => captureSources(ledger, [source("Second parallel result.")], NOW)),
    ]);
    expect(state.read().sources.map((s) => s.text)).toEqual([
      "External request's result.",
      "First parallel result.",
      "Second parallel result.",
    ]);
    expect((await createResearchLedgerSession(state.store).read())!.sources).toHaveLength(3);
  });
});

describe("research provider adapters", () => {
  test("passes Exa controls and requests complete contents with fresh fetching when requested", async () => {
    const fetcher = mock<typeof fetch>(async () =>
      Response.json({
        results: [
          { url: URL, title: "Report", text: "Full report text", highlights: ["Search excerpt"] },
        ],
      })
    );
    const providers = fakeProviders(fetcher);
    const results = await providers.search({
      query: "test",
      numResults: 6,
      includeDomains: ["example.com"],
      startPublishedDate: NOW,
    });
    expect(results[0]!.excerptOnly).toBe(true);
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toMatchObject({
      includeDomains: ["example.com"],
      numResults: 6,
      startPublishedDate: NOW,
    });
    const read = await providers.read([URL], true);
    expect(read.sources[0]!.excerptOnly).toBe(false);
    expect(JSON.parse(fetcher.mock.calls[1]![1]!.body as string)).toMatchObject({
      urls: [URL],
      maxAgeHours: 0,
      text: { maxCharacters: 80_000 },
    });
  });

  test("sends Firecrawl a structured extraction schema and bounded crawl settings", async () => {
    const fetcher = mock<typeof fetch>(async (url) =>
      String(url).endsWith("/crawl")
        ? Response.json({ success: true, id: "owned-job" })
        : Response.json({
            success: true,
            data: {
              markdown: "Source page text",
              json: { price: 12 },
              metadata: { sourceURL: URL },
            },
          })
    );
    const providers = fakeProviders(fetcher);
    const scrape = await providers.scrape(URL, [
      { name: "price", type: "number", description: "Monthly price" },
    ]);
    expect(scrape.structuredData).toEqual({ price: 12 });
    expect(
      JSON.parse(fetcher.mock.calls[0]![1]!.body as string).formats[1].schema.properties.price.type
    ).toBe("number");
    await providers.startCrawl(URL, 5);
    expect(JSON.parse(fetcher.mock.calls[1]![1]!.body as string)).toMatchObject({
      limit: 5,
      allowExternalLinks: false,
      maxDiscoveryDepth: 2,
    });
  });

  test("parses Docling text and table page provenance and marks the requested range as partial", async () => {
    const fetcher = mock<typeof fetch>(async () =>
      Response.json({
        status: "success",
        document: {
          md_content: "A document with a table",
          json_content: {
            name: "Study",
            texts: [{ text: "The study included 120 participants.", prov: [{ page_no: 2 }] }],
            tables: [
              {
                prov: [{ page_no: 3 }],
                data: { table_cells: [{ text: "Control" }, { text: "120" }] },
              },
            ],
          },
        },
      })
    );
    const result = await fakeProviders(fetcher).parseDocument(URL, 1, 10);
    expect(result.source.locations).toEqual([
      { page: 2, text: "The study included 120 participants." },
      { page: 3, text: "Control | 120" },
    ]);
    expect(result.source.truncated).toBe(true);
    const request = fetcher.mock.calls[0]![1]!;
    expect(request.headers).toMatchObject({ "X-Api-Key": "test-docling" });
    expect(JSON.parse(request.body as string)).toMatchObject({
      target: { kind: "inbody" },
      options: { page_range: [1, 10], do_ocr: true, to_formats: ["md", "json"] },
    });
  });

  test("rejects private URLs and missing configuration without a network call", async () => {
    const fetcher = mock<typeof fetch>(async () => Response.json({}));
    const providers = createResearchProviders({
      exaKey: "",
      firecrawlKey: "",
      doclingUrl: "",
      fetch: fetcher,
    });
    await expect(providers.read(["https://127.0.0.1/private"], false)).rejects.toThrow(
      "not public"
    );
    await expect(providers.search({ query: "test", numResults: 1 })).rejects.toThrow("EXA_API_KEY");
    await expect(providers.parseDocument(URL, 1, 10)).rejects.toThrow("DOCLING_SERVE_URL");
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("bounds oversized responses and excludes provider bodies from errors", async () => {
    const big = fakeProviders(
      mock<typeof fetch>(async () => new Response("x".repeat(4 * 1024 * 1024 + 1)))
    );
    await expect(big.search({ query: "test", numResults: 1 })).rejects.toThrow("size limit");
    const failing = fakeProviders(
      mock<typeof fetch>(async () => new Response("secret provider credential", { status: 401 }))
    );
    await expect(failing.search({ query: "test", numResults: 1 })).rejects.toThrow("HTTP 401");
  });
});

describe("research tools", () => {
  test("publishes synopses with server-resolved links and evidence, refusing invented ids", async () => {
    const state = memoryStore();
    const captured = captureSources(emptyResearchLedger(), [source()], NOW);
    if (!captured.ok) throw new Error("Fixture failed");
    const recorded = recordClaim(
      captured.ledger,
      {
        statement: "The sample was 120.",
        assessment: "Descriptive finding.",
        evidence: [
          {
            sourceId: captured.value[0]!.id,
            quote: "The study included 120 participants.",
            relation: "supports",
          },
        ],
      },
      NOW
    );
    if (!recorded.ok) throw new Error("Fixture failed");
    await state.store.save(recorded.ledger, null);
    const tools = createResearchTools({
      threadId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      ownerId: "owner",
      store: state.store,
    });
    const input = {
      title: "Sample review",
      summary: "The study described 120 participants.",
      sources: [
        {
          sourceId: captured.value[0]!.id,
          synopsis: "An exploratory study.",
          takeaways: ["Check its applicability."],
        },
      ],
      claimIds: [recorded.value.id],
      limitations: [],
    };
    expect(
      await tools.research_publish.execute!(
        { ...input, sources: [{ ...input.sources[0]!, sourceId: "invented" }] },
        CALL
      )
    ).toMatchObject({ error: "Unknown source id in this thread." });
    expect(await tools.research_publish.execute!(input, CALL)).toMatchObject({
      block: {
        type: "research-report",
        sources: [
          { url: URL, synopsis: "An exploratory study.", takeaways: ["Check its applicability."] },
        ],
        claims: [{ evidence: [{ url: URL, quote: "The study included 120 participants." }] }],
      },
    });
  });

  test("cleans up a paid crawl if saving its ownership fails", async () => {
    const fetcher = mock<typeof fetch>(async (url) =>
      String(url).endsWith("/crawl")
        ? Response.json({ success: true, id: "new-job" })
        : Response.json({ success: true })
    );
    const tools = createResearchTools({
      threadId: "a",
      ownerId: "o",
      providers: fakeProviders(fetcher),
      checkLimit: async () => ({ success: true }),
      store: {
        load: async () => ({ ledger: emptyResearchLedger(), revision: null }),
        save: async () => {
          throw new Error("Database unavailable");
        },
      },
    });
    expect(
      await tools.research_crawl.execute!({ action: "start", url: URL, limit: 5 }, CALL)
    ).toMatchObject({ error: "Database unavailable" });
    expect(fetcher.mock.calls[1]![1]!.method).toBe("DELETE");
  });

  test("captures sources, rereads stored text, records claims, and audits across turns", async () => {
    const state = memoryStore();
    const fetcher = mock<typeof fetch>(async () =>
      Response.json({ results: [{ url: URL, text: "The study included 120 participants." }] })
    );
    const tools = createResearchTools({
      threadId: "a",
      ownerId: "owner-a",
      store: state.store,
      providers: fakeProviders(fetcher),
      checkLimit: async () => ({ success: true }),
      now: () => NOW,
    });
    const result = await tools.research_read.execute!({ urls: [URL], fresh: false }, CALL);
    expect(result).toMatchObject({ saved: true });
    const id = state.read().sources[0]!.id;
    expect(
      await tools.research_source.execute!({ sourceId: id, offset: 0, limit: 12_000 }, CALL)
    ).toMatchObject({ untrustedText: "The study included 120 participants." });
    expect(
      await tools.research_record_claim.execute!(
        {
          statement: "The sample was 120.",
          assessment: "Directly reported sample size.",
          evidence: [
            { sourceId: id, quote: "The study included 120 participants.", relation: "supports" },
          ],
        },
        CALL
      )
    ).toMatchObject({ saved: true });
    const next = createResearchTools({
      threadId: "a",
      ownerId: "owner-a",
      store: state.store,
      providers: fakeProviders(fetcher),
    });
    expect(await next.research_audit.execute!({ offset: 0, limit: 5 }, CALL)).toMatchObject({
      claims: [{ statement: "The sample was 120.", issues: [] }],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("rejects unowned crawl ids and persists owned jobs for later assignments", async () => {
    const state = memoryStore();
    const fetcher = mock<typeof fetch>(async (url) =>
      String(url).includes("?")
        ? Response.json({
            status: "completed",
            completed: 1,
            data: [
              { markdown: "The study included 120 participants.", metadata: { sourceURL: URL } },
            ],
          })
        : Response.json({ success: true, id: "job-a" })
    );
    const args = {
      threadId: "a",
      ownerId: "owner-a",
      store: state.store,
      providers: fakeProviders(fetcher),
      checkLimit: async () => ({ success: true }),
    };
    const tools = createResearchTools(args);
    expect(
      await tools.research_crawl.execute!(
        { action: "status", jobId: "someone-elses-job", skip: 0 },
        CALL
      )
    ).toMatchObject({ error: "Unknown crawl job in this thread." });
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      await tools.research_crawl.execute!({ action: "start", url: URL, limit: 5 }, CALL)
    ).toMatchObject({ jobId: "job-a" });
    const next = createResearchTools(args);
    expect(
      await next.research_crawl.execute!({ action: "status", jobId: "job-a", skip: 0 }, CALL)
    ).toMatchObject({ status: "completed", saved: true });
    const other = createResearchTools({
      ...args,
      ownerId: "owner-b",
      threadId: "b",
      store: memoryStore().store,
    });
    expect(
      await other.research_crawl.execute!({ action: "status", jobId: "job-a", skip: 0 }, CALL)
    ).toMatchObject({ error: "Unknown crawl job in this thread." });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("rate limits provider calls and reports unavailable storage without claiming evidence was saved", async () => {
    const fetcher = mock<typeof fetch>(async () =>
      Response.json({ results: [{ url: URL, text: "The study included 120 participants." }] })
    );
    const tools = createResearchTools({
      threadId: "a",
      ownerId: "owner-a",
      store: { load: async () => null, save: async () => ({ status: "unavailable" }) },
      providers: fakeProviders(fetcher),
      checkLimit: async () => ({ success: true }),
    });
    expect(await tools.research_read.execute!({ urls: [URL], fresh: false }, CALL)).toMatchObject({
      saved: false,
    });
    const denied = createResearchTools({
      threadId: "a",
      ownerId: "owner-a",
      store: memoryStore().store,
      providers: fakeProviders(fetcher),
      checkLimit: async () => ({ success: false, error: "Rate limit" }),
    });
    expect(await denied.research_read.execute!({ urls: [URL], fresh: false }, CALL)).toMatchObject({
      error: "Rate limit",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("research persistence boundaries", () => {
  test("retains delegated research results in Lyra's thread and replays them as model tool messages", async () => {
    const output = { sources: [{ untrustedText: "x".repeat(12_000) }] };
    const toolParts = researchToolParts([
      {
        toolResults: [
          {
            toolName: "research_read",
            toolCallId: "read",
            input: { urls: [URL], fresh: false },
            output,
          },
        ],
      },
    ]);
    const reply = buildSubagentReplyMessage({
      text: "Found a source.",
      goalId: "g",
      modelId: "m",
      toolParts,
    });
    expect(JSON.stringify(reply)).toContain("research_read");
    expect(JSON.stringify(reply)).not.toContain("x".repeat(1_201));
    expect((await convertToModelMessages([reply])).some((message) => message.role === "tool")).toBe(
      true
    );
    const saved: unknown[] = [];
    const result = await runSubagentThreadTurn({
      goal: {
        goalId: "g",
        agentId: "agent-researcher",
        goal: "Review the study.",
        assignedAt: 0,
        orchestratorId: "parent",
      },
      threadId: "lyra",
      ownerId: "owner",
      modelId: "m",
      zeroDataRetention: true,
      lockedPersona: getHardSetSubagent("agent-researcher")!,
      generate: async (args) => {
        expect(args.tools?.research).toBe(true);
        expect(args.system).toContain("You are Lyra");
        return { text: "Found a source.", toolParts };
      },
      store: {
        loadMessages: async () => [],
        appendMessages: async (_id, messages) => {
          saved.push(...messages);
          return true;
        },
        setStatus: async () => {},
      },
    });
    expect(result.completed).toBe(true);
    expect(JSON.stringify(saved)).toContain("research_read");
  });
});
