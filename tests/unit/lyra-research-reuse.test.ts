import type { ResearchLedgerStore, RetrievedSource } from "@/lib/llm/subagents/research/ledger";
import type { ResearchReusePolicy } from "@/lib/llm/subagents/research/reuse";

import { describe, expect, mock, test } from "bun:test";

import {
  captureSources,
  emptyResearchLedger,
  ResearchLedgerSchema,
} from "@/lib/llm/subagents/research/ledger";
import { createResearchProviders } from "@/lib/llm/subagents/research/providers";
import { createResearchTools } from "@/lib/llm/subagents/research/tools";
import {
  readResearchReusePolicy,
  researchAnnotationKey,
  researchReuseKey,
  researchUrlKey,
} from "@/lib/llm/subagents/research/reuse";

const NOW = "2026-10-10T12:00:00.000Z";
const URL = "https://example.com/research/report?edition=1";
const CALL = { toolCallId: "test", messages: [] };
const THREAD = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
function policy(provider: "exa" | "docling" = "exa"): ResearchReusePolicy {
  return {
    version: 1,
    grants: [
      {
        provider,
        reference: "test reviewed provider and publisher permission",
        expiresAt: "2026-11-10T12:00:00.000Z",
        urlPrefixes: ["https://example.com/research/"],
        purposes: ["retrieval", "annotation"],
        maxTtlSeconds: 86_400,
      },
    ],
  };
}
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
function fixture(options: { reusePolicy?: ResearchReusePolicy; fetcher?: typeof fetch } = {}) {
  const state = memoryStore();
  let clock = NOW;
  const fetcher =
    options.fetcher ??
    mock<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      const urls: string[] = body.urls ?? [URL];
      return Response.json({
        results: urls.map((url) => ({
          url,
          title: "Report",
          text: "The study included 120 participants.",
          highlights: ["Search excerpt"],
        })),
      });
    });
  const limit = mock(async () => ({ success: true }));
  const providers = createResearchProviders({
    exaKey: "test",
    fetch: fetcher,
    validateUrl: async (url) => url,
  });
  const args = {
    threadId: THREAD,
    ownerId: "owner",
    store: state.store,
    providers,
    checkLimit: limit,
    now: () => clock,
    reusePolicy: options.reusePolicy ?? policy(),
    modelId: "test/model",
  };
  return {
    ...state,
    fetcher,
    limit,
    args,
    tools: createResearchTools(args),
    setClock: (value: string) => {
      clock = value;
    },
  };
}
const read = (tools: ReturnType<typeof createResearchTools>, urls = [URL], fresh = false) =>
  tools.research_read.execute!({ urls, fresh }, CALL);

describe("research reuse permissions", () => {
  test("missing, malformed, oversized, unsafe and expired policies cannot enable Exa caching", async () => {
    for (const raw of [
      "",
      "{broken",
      " ".repeat(64_001),
      JSON.stringify({
        version: 1,
        grants: [{ ...policy().grants[0], urlPrefixes: ["http://localhost/"] }],
      }),
    ])
      expect(readResearchReusePolicy(raw).grants).toHaveLength(0);
    for (const reusePolicy of [
      { version: 1 as const, grants: [] },
      {
        version: 1 as const,
        grants: [{ ...policy().grants[0]!, expiresAt: "2026-01-01T00:00:00.000Z" }],
      },
    ]) {
      const f = fixture({ reusePolicy });
      await read(f.tools);
      await read(f.tools);
      expect(f.fetcher).toHaveBeenCalledTimes(2);
      expect(f.read().reuse).toHaveLength(0);
      expect(await f.tools.research_capabilities.execute!({}, CALL)).toMatchObject({
        localExaReuse: false,
      });
    }
  });

  test("publisher scope checks path boundaries and returned URLs, with no subdomain or origin widening", async () => {
    for (const url of [
      "https://example.com/research-other/report",
      "https://sub.example.com/research/report",
      "https://example.com.evil.test/research/report",
    ]) {
      const f = fixture();
      await read(f.tools, [url]);
      await read(f.tools, [url]);
      expect(f.fetcher).toHaveBeenCalledTimes(2);
      expect(f.read().reuse).toHaveLength(0);
    }
    const f = fixture({
      fetcher: mock<typeof fetch>(async () =>
        Response.json({
          results: [{ url: "https://outside.example/report", text: "Outside source" }],
        })
      ),
    });
    await f.tools.research_search.execute!({ query: "test", numResults: 6 }, CALL);
    await f.tools.research_search.execute!({ query: "test", numResults: 6 }, CALL);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(f.read().reuse).toHaveLength(0);
  });

  test("revocation or changed permission blocks old hits immediately", async () => {
    const f = fixture();
    await read(f.tools);
    await read(createResearchTools({ ...f.args, reusePolicy: { version: 1, grants: [] } }));
    await read(
      createResearchTools({
        ...f.args,
        reusePolicy: {
          ...policy(),
          grants: [{ ...policy().grants[0]!, reference: "different agreement" }],
        },
      })
    );
    expect(f.fetcher).toHaveBeenCalledTimes(3);
  });

  test("cache keys preserve paths, query values, case and every search control", () => {
    expect(researchUrlKey(`${URL}#section`)).toBe(URL);
    expect(researchUrlKey("https://example.com/Report")).not.toBe(
      researchUrlKey("https://example.com/report")
    );
    expect(researchReuseKey("search", { query: "A", numResults: 6 })).not.toBe(
      researchReuseKey("search", { query: "a", numResults: 6 })
    );
    expect(researchReuseKey("search", { query: "A", numResults: 6 })).toBe(
      researchReuseKey("search", { numResults: 6, query: "A" })
    );
    for (const changed of [
      { numResults: 5 },
      { includeDomains: ["example.com"] },
      { excludeDomains: ["other.example"] },
      { startPublishedDate: NOW },
      { endPublishedDate: NOW },
      { category: "news" },
    ])
      expect(researchReuseKey("search", { query: "A", numResults: 6, ...changed })).not.toBe(
        researchReuseKey("search", { query: "A", numResults: 6 })
      );
  });
});

describe("Exa request reuse", () => {
  test("reuses a URL across turns and batches, preserving capture dates and skipping spending limits", async () => {
    const f = fixture();
    await read(f.tools);
    const next = createResearchTools(f.args);
    expect(await read(next)).toMatchObject({ saved: true, cache: { hits: 1, providerCalls: 0 } });
    const second = "https://example.com/research/second";
    expect(await read(next, [URL, second, `${URL}#fragment`])).toMatchObject({
      cache: { hits: 1, providerCalls: 1 },
    });
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(f.limit).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(
        (f.fetcher as ReturnType<typeof mock<typeof fetch>>).mock.calls[1]![1]!.body as string
      ).urls
    ).toEqual([second]);
    expect(f.read().sources).toHaveLength(2);
    expect(f.read().sources[0]!.fetchedAt).toBe(NOW);
    expect(JSON.stringify(f.read().reuse)).not.toContain("120 participants");
  });

  test("page and search TTLs expire, and policy TTL can shorten them", async () => {
    const f = fixture();
    await read(f.tools);
    f.setClock("2026-10-10T13:00:00.000Z");
    await read(f.tools);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    await f.tools.research_search.execute!({ query: "test", numResults: 6 }, CALL);
    f.setClock("2026-10-10T13:05:00.000Z");
    await f.tools.research_search.execute!({ query: "test", numResults: 6 }, CALL);
    expect(f.fetcher).toHaveBeenCalledTimes(4);
    const short = fixture({
      reusePolicy: { version: 1, grants: [{ ...policy().grants[0]!, maxTtlSeconds: 1 }] },
    });
    await read(short.tools);
    short.setClock("2026-10-10T12:00:01.000Z");
    await read(short.tools);
    expect(short.fetcher).toHaveBeenCalledTimes(2);
  });

  test("fresh requests bypass and replace cache entries using maxAgeHours:0", async () => {
    let text = "First report";
    const f = fixture({
      fetcher: mock<typeof fetch>(async () => Response.json({ results: [{ url: URL, text }] })),
    });
    await read(f.tools);
    text = "Updated report";
    await read(f.tools, [URL], true);
    expect(await read(f.tools)).toMatchObject({
      sources: [{ untrustedText: "Updated report" }],
      cache: { hits: 1 },
    });
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(
        (f.fetcher as ReturnType<typeof mock<typeof fetch>>).mock.calls[1]![1]!.body as string
      ).maxAgeHours
    ).toBe(0);
    expect(f.read().sources).toHaveLength(2);
  });

  test("search caches the exact query/options and fresh bypass invalidates earlier results", async () => {
    const f = fixture();
    const input = { query: "test", numResults: 6 };
    await f.tools.research_search.execute!(input, CALL);
    expect(await f.tools.research_search.execute!(input, CALL)).toMatchObject({
      cache: { hits: 1, providerCalls: 0 },
    });
    await f.tools.research_search.execute!({ ...input, category: "news" }, CALL);
    await f.tools.research_search.execute!({ ...input, fresh: true }, CALL);
    expect(f.fetcher).toHaveBeenCalledTimes(3);
  });

  test("collapses overlapping reads across tool instances in the same process", async () => {
    const f = fixture();
    const results = await Promise.all([read(f.tools), read(createResearchTools(f.args))]);
    expect(results[1]).toMatchObject({ cache: { hits: 1, providerCalls: 0 } });
    expect(f.fetcher).toHaveBeenCalledTimes(1);
  });

  test("does not cache errors, empty results, denied sources or unsuccessful URL statuses", async () => {
    for (const response of [
      () => new Response("failure", { status: 500 }),
      () => Response.json({ results: [] }),
      () =>
        Response.json({
          results: [{ url: URL, text: "Incomplete result" }],
          statuses: [{ id: URL, status: "error" }],
        }),
    ]) {
      const f = fixture({ fetcher: mock<typeof fetch>(async () => response()) });
      await read(f.tools);
      await read(f.tools);
      expect(f.fetcher).toHaveBeenCalledTimes(2);
      expect(f.read().reuse).toHaveLength(0);
    }
  });

  test("different owners/threads and unavailable storage cannot receive another ledger's cache", async () => {
    const f = fixture();
    await read(f.tools);
    const other = memoryStore();
    await read(
      createResearchTools({ ...f.args, ownerId: "other", threadId: "other", store: other.store })
    );
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    const unavailable = createResearchTools({
      ...f.args,
      ownerId: "unavailable",
      store: { load: async () => null, save: async () => ({ status: "unavailable" }) },
    });
    expect(await read(unavailable)).toMatchObject({
      saved: false,
      cache: { hits: 0, providerCalls: 1 },
    });
  });
});

describe("generated annotation reuse", () => {
  test("old ledgers load without cache entries", () => {
    expect(
      ResearchLedgerSchema.parse({ version: 1, sources: [], claims: [], crawls: [] }).reuse
    ).toEqual([]);
  });

  test("eligible notes reuse exact source version/model/prompt/context without another LLM call", async () => {
    const f = fixture({ reusePolicy: policy("docling") });
    const input: RetrievedSource = {
      url: URL,
      title: "Report",
      text: "Source text",
      provider: "docling",
      publishedAt: null,
      locations: [],
      excerptOnly: false,
      truncated: true,
    };
    const captured = captureSources(emptyResearchLedger(), [input], NOW);
    if (!captured.ok) throw new Error("Fixture failed");
    await f.store.save(captured.ledger, null);
    const id = captured.value[0]!.id;
    const context = "Explain the study methods.";
    const publish = await f.tools.research_publish.execute!(
      {
        title: "Report",
        summary: "Summary",
        sources: [{ sourceId: id, synopsis: "A methods report", takeaways: ["Check sample bias"] }],
        claimIds: [],
        limitations: [],
        annotationContext: context,
      },
      CALL
    );
    expect(publish).toMatchObject({ annotationsSaved: 1 });
    const query = { sourceIds: [id], context };
    expect(
      await createResearchTools(f.args).research_annotations.execute!(query, CALL)
    ).toMatchObject({
      annotations: [{ sourceId: id, reused: true, synopsis: "A methods report" }],
    });
    for (const tools of [
      createResearchTools({ ...f.args, modelId: "different/model" }),
      createResearchTools({ ...f.args, generationContext: "changed conversation" }),
      createResearchTools({ ...f.args, reusePolicy: { version: 1, grants: [] } }),
    ])
      expect(await tools.research_annotations.execute!(query, CALL)).toMatchObject({
        annotations: [{ reused: false }],
      });
    expect(
      await f.tools.research_annotations.execute!({ ...query, context: "Other question" }, CALL)
    ).toMatchObject({ annotations: [{ reused: false }] });
    expect(
      await f.tools.research_annotations.execute!({ ...query, fresh: true }, CALL)
    ).toMatchObject({ annotations: [{ reused: false }] });
    expect(f.fetcher).not.toHaveBeenCalled();
    const original = captured.value[0]!;
    expect(researchAnnotationKey(original, "m", context)).not.toBe(
      researchAnnotationKey({ ...original, sha256: "changed" }, "m", context)
    );
    expect(researchAnnotationKey(original, "m", context)).not.toBe(
      researchAnnotationKey({ ...original, excerptOnly: true }, "m", context)
    );
  });

  test("Exa-derived annotations are not cached without explicit annotation permission", async () => {
    const f = fixture({
      reusePolicy: { version: 1, grants: [{ ...policy().grants[0]!, purposes: ["retrieval"] }] },
    });
    await read(f.tools);
    const id = f.read().sources[0]!.id;
    expect(
      await f.tools.research_publish.execute!(
        {
          title: "Report",
          summary: "Summary",
          sources: [{ sourceId: id, synopsis: "Synopsis", takeaways: [] }],
          claimIds: [],
          limitations: [],
          annotationContext: "Task",
        },
        CALL
      )
    ).toMatchObject({ annotationsSaved: 0 });
    expect(
      await f.tools.research_annotations.execute!({ sourceIds: [id], context: "Task" }, CALL)
    ).toMatchObject({ annotations: [{ reused: false }] });
    expect(
      await f.tools.research_annotations.execute!(
        { sourceIds: ["invented"], context: "Task" },
        CALL
      )
    ).toMatchObject({ error: "Unknown source id in this thread." });
  });
});
