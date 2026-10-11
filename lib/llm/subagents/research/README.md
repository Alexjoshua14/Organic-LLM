# Lyra research tools

Lyra uses Exa, Firecrawl, Docling Serve, and a thread-scoped evidence ledger. Her fixed
definition is [`../hard-set/agents/researcher.ts`](../hard-set/agents/researcher.ts). The
existing `agent-researcher` roster slot resolves to that definition; saved child threads keep
their identity. A lab shell uses the canonical `subagent-researcher` id.

## Configuration

No additional JavaScript packages or local document service are required by these adapters.
Configure only the services you intend to use:

| Setting | Purpose |
|---------|---------|
| `EXA_API_KEY` | Exa search and page contents; shared with the existing web-search integration. |
| `FIRECRAWL_API_KEY` | Firecrawl v2 scrape, map, and asynchronous crawl. |
| `DOCLING_SERVE_URL` | Base URL of an existing Docling Serve service. Use HTTPS for a remote service. |
| `DOCLING_SERVE_API_KEY` | Optional Docling Serve `X-Api-Key`. |

Apply [`threads_research_ledger.sql`](../../../../docs/migrations/threads_research_ledger.sql)
through the normal database migration process. It adds two nullable columns; it is never
applied by a chat turn. The ledger uses the app's existing message-encryption key configuration.

`research_capabilities` reports provider and storage availability. Missing keys disable only
their provider. When storage is unavailable, retrieved text remains inspectable in tool
results, but no saved source ids, verified claims, or published reports are fabricated.

Provider contracts: [Exa search](https://exa.ai/docs/reference/search),
[Exa contents](https://exa.ai/docs/reference/get-contents),
[Firecrawl scrape](https://docs.firecrawl.dev/api-reference/endpoint/scrape),
[Firecrawl crawl](https://docs.firecrawl.dev/api-reference/endpoint/crawl-post), and
[Docling Serve](https://github.com/docling-project/docling-serve).

## Tool contract

| Tool | Behavior |
|------|----------|
| `research_capabilities` | Check provider keys/service configuration and evidence storage. |
| `research_search` | Exa discovery with domain, publication-date and category filters; up to 10 search excerpts. |
| `research_read` | Exa page contents for up to 5 public HTTPS URLs, with optional fresh fetching. |
| `research_scrape` | Firecrawl markdown plus optional extraction of up to 12 named fields. Extracted values remain untrusted interpretations. |
| `research_map` | Discover up to 30 public HTTPS links from a site. |
| `research_crawl` | Start a crawl of at most 10 pages and depth 2, check results, or cancel. Poll/cancel requires a job id recorded in this thread. |
| `research_parse_document` | Docling OCR, markdown, tables and available page provenance; at most 40 requested pages. |
| `research_source` | Read further portions of a captured snapshot, optionally selecting a document page. No new provider call. |
| `research_record_claim` | Save/revise a finding with supporting, contradictory or contextual quotations and Lyra's assessment. |
| `research_audit` | Page through saved findings and flag missing support, contradictions, unmatched quotes, excerpts and partial sources. |
| `research_publish` | Publish a `research-report` Gen UI block with synopses, takeaways and server-resolved source metadata/evidence; at most 2 per turn. |

The dedicated toolbox also permits thread history according to the persona's policy. It is
used by live shell/child-thread turns, queued direct turns and delegated background workers.

## Evidence and storage

Each fetch creates an immutable snapshot with its URL, provider, capture time, available
publication date, raw bounded text, page locations, scope flags and SHA-256 of the captured
text/locations. Identical snapshots are deduplicated. A changed page gets a new id rather than
rewriting the text under an existing citation.

Claim quotations must match captured text after Unicode/whitespace normalization. A supplied
page number must match that page's captured text. The relationship between a quotation and a
claim is still Lyra's interpretation. Audits establish traceability, not truth, methodology
quality or publisher independence. A Docling page-range conversion always carries a partial
flag; complete-document coverage is not assumed.

The ledger is encrypted in `threads.research_ledger`, with owner and thread bound into the
authenticated encryption context. Every database read/write filters by thread and owner. A
revision guard retries concurrent writes without discarding another turn's findings. Limits:
60 sources, 100 claims, 10 crawl jobs, 80,000 text characters per source, and 1,500,000 serialized
ledger characters. Provider responses are capped at 4 MiB and calls have deadlines; a turn
allows at most 12 provider calls plus best-effort cancellation of an unpersisted crawl.

## Inspecting research in chat

Retrieval tools render expandable source cards. Published reports add article synopses,
Lyra's takeaways, evidence quotations, contradictions and limitations. Scope labels distinguish
search excerpts, partial captures and captured pages. Original links open separately.

**Read captured text** lazily calls
`GET /api/chat/[id]/research/sources/[sourceId]` with a bounded offset/page selection. The route
requires authentication and thread ownership and returns `private, no-store` responses. It
reads the saved snapshot rather than fetching the website again. Text is rendered as text,
never as third-party HTML. Controls support keyboard navigation and the existing spacing tokens.

Live and queued chat use normal tool-message persistence. Delegated workers also save native
research tool parts with their reply. Saved retrieval previews are compact; full source
snapshots remain in the ledger. Reports survive reload and are included in copy-to-Markdown.

## Verification

The focused tests are `tests/unit/lyra-research.test.ts` and
`tests/unit/lyra-research-ui.test.tsx`. Provider traffic is mocked; tests do not spend service
credits or start Docling. They cover request contracts, immutable evidence, quote/page checks,
concurrent writes, encrypted ownership, background tool persistence, report generation and
on-demand reading. Live service access and an applied migration are separate deployment checks.
