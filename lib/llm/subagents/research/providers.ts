import "server-only";

import type { RetrievedSource } from "./ledger";

import { z } from "zod";

import { RESEARCH_LIMITS } from "./ledger";

import { assertSafePublicHttpsUrl } from "@/lib/security/external-content/safe-url";
import { assertSafePublicHttpsUrlResolved } from "@/lib/security/external-content/safe-url-resolved";

const REQUEST_TIMEOUT_MS = 30_000;
const DOCUMENT_TIMEOUT_MS = 60_000;
const RESPONSE_MAX_BYTES = 4 * 1024 * 1024;
const ExaResponseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string().nullish(),
      text: z.string().nullish(),
      highlights: z.array(z.string()).nullish(),
      publishedDate: z.string().nullish(),
    })
  ),
  statuses: z.array(z.object({ id: z.string(), status: z.string() }).passthrough()).optional(),
});
const FireDocumentSchema = z.object({
  markdown: z.string().optional(),
  json: z.unknown().optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      sourceURL: z.string().optional(),
      url: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export type ResearchProviderConfig = {
  exaKey?: string;
  firecrawlKey?: string;
  doclingUrl?: string;
  doclingKey?: string;
  fetch?: typeof fetch;
  validateUrl?: (url: string) => Promise<string>;
};
export type ExtractionField = {
  name: string;
  description: string;
  type: "string" | "number" | "boolean";
};

function requirePublicUrl(url: string): string {
  const safe = assertSafePublicHttpsUrl(url);

  if (!safe.ok) throw new Error("Research sources must use public HTTPS URLs.");

  return safe.href;
}

/** Fixed provider endpoints, bounded responses and deadlines; never echo provider bodies or credentials in errors. */
export function createResearchProviders(config: ResearchProviderConfig = {}) {
  const fetcher = config.fetch ?? fetch;
  const exaKey = config.exaKey ?? process.env.EXA_API_KEY;
  const firecrawlKey = config.firecrawlKey ?? process.env.FIRECRAWL_API_KEY;
  const doclingUrl = config.doclingUrl ?? process.env.DOCLING_SERVE_URL;
  const doclingKey = config.doclingKey ?? process.env.DOCLING_SERVE_API_KEY;
  const validateUrl =
    config.validateUrl ??
    (async (url: string) => {
      const safe = await assertSafePublicHttpsUrlResolved(url);

      if (!safe.ok) throw new Error("Research source URL is unavailable or is not public HTTPS.");

      return safe.href;
    });

  async function request(
    url: string,
    headers: Record<string, string>,
    body?: unknown,
    method = "POST",
    timeout = REQUEST_TIMEOUT_MS
  ): Promise<unknown> {
    let response: Response;

    try {
      response = await fetcher(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeout),
        redirect: "error",
        cache: "no-store",
      });
    } catch {
      throw new Error("Research provider timed out or could not be reached.");
    }
    if (!response.ok) throw new Error(`Research provider returned HTTP ${response.status}.`);
    const reader = response.body?.getReader();

    if (!reader) throw new Error("Research provider returned an empty response.");
    const chunks: Uint8Array[] = [];
    let length = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        length += value.byteLength;
        if (length > RESPONSE_MAX_BYTES) {
          await reader.cancel();
          throw new Error("Research provider response exceeded the size limit.");
        }
        chunks.push(value);
      }
      const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));

      if (z.object({ success: z.literal(false) }).safeParse(data).success)
        throw new Error("Research provider reported an unsuccessful operation.");

      return data;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Research provider")) throw error;
      throw new Error("Research provider returned an unreadable response.");
    }
  }

  function exa(path: string, body: unknown) {
    if (!exaKey) throw new Error("Exa is not configured. Set EXA_API_KEY.");

    return request(`https://api.exa.ai/${path}`, { "x-api-key": exaKey }, body);
  }
  function firecrawl(path: string, body?: unknown, method = "POST") {
    if (!firecrawlKey) throw new Error("Firecrawl is not configured. Set FIRECRAWL_API_KEY.");

    return request(
      `https://api.firecrawl.dev/v2/${path}`,
      { Authorization: `Bearer ${firecrawlKey}` },
      body,
      method
    );
  }
  const fromExa = (
    result: z.infer<typeof ExaResponseSchema>["results"][number],
    excerptOnly: boolean
  ): RetrievedSource => ({
    url: requirePublicUrl(result.url),
    title: result.title ?? result.url,
    provider: "exa",
    text: excerptOnly ? result.highlights?.join("\n") || result.text || "" : result.text || "",
    publishedAt: result.publishedDate ?? null,
    locations: [],
    excerptOnly,
    truncated: false,
  });
  const fromFirecrawl = (
    data: z.infer<typeof FireDocumentSchema>,
    fallbackUrl: string
  ): RetrievedSource => ({
    url: requirePublicUrl(data.metadata?.sourceURL ?? data.metadata?.url ?? fallbackUrl),
    title: data.metadata?.title ?? fallbackUrl,
    provider: "firecrawl",
    text: data.markdown ?? "",
    publishedAt: null,
    locations: [],
    excerptOnly: false,
    truncated: false,
  });

  return {
    capabilities: () => ({
      exa: Boolean(exaKey),
      firecrawl: Boolean(firecrawlKey),
      docling: Boolean(doclingUrl),
    }),
    search: async (args: {
      query: string;
      numResults: number;
      includeDomains?: string[];
      excludeDomains?: string[];
      startPublishedDate?: string;
      endPublishedDate?: string;
      category?: "research paper" | "news" | "company";
    }) => {
      const parsed = ExaResponseSchema.parse(
        await exa("search", { ...args, type: "auto", contents: { highlights: true } })
      );

      return parsed.results.map((r) => fromExa(r, true));
    },
    read: async (urls: string[], fresh: boolean) => {
      const safeUrls = await Promise.all(urls.map(validateUrl));
      const parsed = ExaResponseSchema.parse(
        await exa("contents", {
          urls: safeUrls,
          text: { maxCharacters: RESEARCH_LIMITS.sourceChars },
          ...(fresh ? { livecrawl: "always" } : {}),
        })
      );

      return {
        sources: parsed.results.filter((r) => r.text?.trim()).map((r) => fromExa(r, false)),
        statuses: parsed.statuses ?? [],
      };
    },
    scrape: async (url: string, fields: ExtractionField[] = []) => {
      const safeUrl = await validateUrl(url);
      const formats: unknown[] = ["markdown"];

      if (fields.length)
        formats.push({
          type: "json",
          schema: {
            type: "object",
            properties: Object.fromEntries(
              fields.map((f) => [f.name, { type: f.type, description: f.description }])
            ),
            required: fields.map((f) => f.name),
          },
        });
      const parsed = z.object({ data: FireDocumentSchema }).parse(
        await firecrawl("scrape", {
          url: safeUrl,
          formats,
          onlyMainContent: true,
          timeout: 25_000,
        })
      );

      return {
        source: fromFirecrawl(parsed.data, safeUrl),
        structuredData: parsed.data.json ?? null,
      };
    },
    map: async (url: string, search?: string) => {
      const safeUrl = await validateUrl(url);

      return z
        .object({
          links: z.array(
            z.object({
              url: z.string(),
              title: z.string().optional(),
              description: z.string().optional(),
            })
          ),
        })
        .parse(
          await firecrawl("map", { url: safeUrl, search, limit: 30, includeSubdomains: false })
        )
        .links.filter((l) => assertSafePublicHttpsUrl(l.url).ok)
        .slice(0, 30);
    },
    startCrawl: async (url: string, limit: number, includePaths?: string[]) => {
      const safeUrl = await validateUrl(url);
      const parsed = z.object({ id: z.string().regex(/^[a-zA-Z0-9-]{1,120}$/) }).parse(
        await firecrawl("crawl", {
          url: safeUrl,
          limit,
          includePaths,
          maxDiscoveryDepth: 2,
          allowExternalLinks: false,
          allowSubdomains: false,
          scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
        })
      );

      return { id: parsed.id, url: safeUrl };
    },
    crawlStatus: async (id: string, url: string, skip: number) => {
      const parsed = z
        .object({
          status: z.string(),
          total: z.number().optional(),
          completed: z.number().optional(),
          next: z.string().optional(),
          data: z.array(FireDocumentSchema).default([]),
        })
        .parse(await firecrawl(`crawl/${encodeURIComponent(id)}?skip=${skip}`, undefined, "GET"));
      let nextSkip: number | null = null;

      if (parsed.next) {
        const next = new URL(parsed.next);

        if (next.origin === "https://api.firecrawl.dev" && next.pathname === `/v2/crawl/${id}`) {
          const cursor = next.searchParams.get("skip");

          if (cursor && /^\d+$/.test(cursor)) nextSkip = Number(cursor);
        }
      }

      return {
        status: parsed.status,
        total: parsed.total,
        completed: parsed.completed,
        nextSkip,
        sources: parsed.data
          .slice(0, 10)
          .filter((d) => d.markdown?.trim() && (d.metadata?.sourceURL || d.metadata?.url))
          .map((d) => fromFirecrawl(d, url)),
      };
    },
    cancelCrawl: async (id: string) => {
      await firecrawl(`crawl/${encodeURIComponent(id)}`, undefined, "DELETE");

      return { cancelled: true };
    },
    parseDocument: async (url: string, firstPage: number, lastPage: number) => {
      if (!doclingUrl)
        throw new Error(
          "Docling is not configured. Set DOCLING_SERVE_URL to your Docling Serve service."
        );
      const endpoint = new URL(`${doclingUrl.replace(/\/$/, "")}/v1/convert/source`);

      if (
        !["https:", "http:"].includes(endpoint.protocol) ||
        endpoint.username ||
        endpoint.password
      )
        throw new Error("Docling service configuration is invalid.");
      const safeUrl = await validateUrl(url);
      const parsed = z
        .object({
          status: z.string(),
          document: z.object({
            md_content: z.string().nullable().optional(),
            json_content: z
              .object({
                name: z.string().optional(),
                texts: z
                  .array(
                    z.object({
                      text: z.string(),
                      prov: z.array(z.object({ page_no: z.number().int().positive() })).default([]),
                    })
                  )
                  .default([]),
                tables: z
                  .array(
                    z.object({
                      prov: z.array(z.object({ page_no: z.number().int().positive() })).default([]),
                      data: z.object({
                        table_cells: z.array(z.object({ text: z.string() })).default([]),
                      }),
                    })
                  )
                  .default([]),
              })
              .nullable()
              .optional(),
          }),
        })
        .parse(
          await request(
            endpoint.href,
            doclingKey ? { "X-Api-Key": doclingKey } : {},
            {
              sources: [{ kind: "http", url: safeUrl }],
              target: { kind: "inbody" },
              options: {
                to_formats: ["md", "json"],
                image_export_mode: "placeholder",
                do_ocr: true,
                do_table_structure: true,
                page_range: [firstPage, lastPage],
                document_timeout: 50,
              },
            },
            "POST",
            DOCUMENT_TIMEOUT_MS
          )
        );

      if (!["success", "partial_success"].includes(parsed.status))
        throw new Error("Docling could not convert this document.");
      const doc = parsed.document.json_content;
      const pages = new Map<number, string[]>();

      for (const item of [
        ...(doc?.texts ?? []),
        ...(doc?.tables ?? []).map((t) => ({
          prov: t.prov,
          text: t.data.table_cells.map((c) => c.text).join(" | "),
        })),
      ]) {
        for (const page of new Set(item.prov.map((p) => p.page_no)))
          pages.set(page, [...(pages.get(page) ?? []), item.text]);
      }
      const locations = [...pages]
        .sort(([a], [b]) => a - b)
        .map(([page, text]) => ({ page, text: text.join("\n") }));
      const text = parsed.document.md_content || locations.map((l) => l.text).join("\n\n");

      if (!text.trim()) throw new Error("Docling returned no readable document text.");
      const source: RetrievedSource = {
        url: safeUrl,
        title: doc?.name ?? safeUrl,
        provider: "docling",
        text,
        locations,
        publishedAt: null,
        excerptOnly: false,
        truncated: true,
      };

      return {
        source,
        status: parsed.status,
        pageRange: [firstPage, lastPage],
        note: "Only the requested page range was parsed. Full-document completeness is not established.",
      };
    },
  };
}
export type ResearchProviders = ReturnType<typeof createResearchProviders>;
