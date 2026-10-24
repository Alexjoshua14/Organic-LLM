# Lyra research tools

Lyra uses Exa, Firecrawl, Docling Serve, and a thread-scoped evidence ledger. Her fixed
definition is [`../hard-set/agents/researcher.ts`](../hard-set/agents/researcher.ts). The
existing `agent-researcher` roster slot resolves to that definition; saved child threads keep
their identity. A lab shell uses the canonical `subagent-researcher` id.

## Configuration

No additional JavaScript packages or local document service are required by these adapters.
Configure only the services you intend to use:

| Setting                 | Purpose                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| `EXA_API_KEY`           | Exa search and page contents; shared with the existing web-search integration. |
| `FIRECRAWL_API_KEY`     | Firecrawl v2 scrape, map, and asynchronous crawl.                              |
| `DOCLING_SERVE_URL`     | Base URL of an existing Docling Serve service. Use HTTPS for a remote service. |
| `DOCLING_SERVE_API_KEY` | Optional Docling Serve `X-Api-Key`.                                            |

Apply [`research_ledgers.sql`](../../../../docs/migrations/research_ledgers.sql)
through the normal database migration process. It creates `research_ledgers` and adds
`threads.research_ledger_id`; it is never applied by a chat turn. The ledger uses the app's
existing message-encryption key configuration. The older thread-payload migration is superseded.

`research_capabilities` reports provider and storage availability. Missing keys disable only
their provider. When storage is unavailable, retrieved text remains inspectable in tool
results, but no saved source ids, verified claims, or published reports are fabricated.

Provider contracts: [Exa search](https://exa.ai/docs/reference/search),
[Exa contents](https://exa.ai/docs/reference/get-contents),
[Firecrawl scrape](https://docs.firecrawl.dev/api-reference/endpoint/scrape),
[Firecrawl crawl](https://docs.firecrawl.dev/api-reference/endpoint/crawl-post), and
[Docling Serve](https://github.com/docling-project/docling-serve).

## Tool contract

| Tool                      | Behavior                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `research_capabilities`   | Check provider keys/service configuration and evidence storage.                                                                                   |
| `research_search`         | Exa discovery with domain, publication-date and category filters; up to 10 search excerpts.                                                       |
| `research_read`           | Exa page contents for up to 5 public HTTPS URLs, with optional fresh fetching.                                                                    |
| `research_scrape`         | Firecrawl markdown plus optional extraction of up to 12 named fields. Extracted values remain untrusted interpretations.                          |
| `research_map`            | Discover up to 30 public HTTPS links from a site.                                                                                                 |
| `research_crawl`          | Start a crawl of at most 10 pages and depth 2, check results, or cancel. Poll/cancel requires a job id recorded in this thread.                   |
| `research_parse_document` | Docling OCR, markdown, tables and available page provenance; at most 40 requested pages.                                                          |
| `research_source`         | Read further portions of a captured snapshot, optionally selecting a document page. No new provider call.                                         |
| `research_record_claim`   | Save/revise a finding with supporting, contradictory or contextual quotations and Lyra's assessment.                                              |
| `research_audit`          | Page through saved findings and flag missing support, contradictions, unmatched quotes, excerpts and partial sources.                             |
| `research_annotations`    | Look up eligible saved synopses/takeaways for exact source version, model, generation context and annotation requirements; no provider/LLM calls. |
| `research_publish`        | Publish a `research-report` Gen UI block with synopses, takeaways and server-resolved source metadata/evidence; at most 2 per turn.               |

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

The ledger is encrypted in `research_ledgers.payload`, with owner and ledger id bound into
the authenticated encryption context. Threads carry only `research_ledger_id`. The composite
foreign key prevents cross-owner links, and the table has owner RLS. Every load follows an
owned thread and then an owned ledger; every save rechecks the thread link and uses a revision
guard. A first use creates one ledger row and attaches it with a null-FK compare-and-set;
concurrent initializers remove unused candidates and converge on the winning link. Missing
migrations, corrupt ciphertext and broken ownership never become silent empty replacements.

The migration copies legacy ciphertext into ledger rows without requiring encryption keys in
SQL. `legacy_thread_id` records its old encryption binding; a successful save re-encrypts with
the ledger binding and clears that marker. Existing legacy thread columns stay as a rollback
copy and are not read or written by the app. New deployments never create them. No automatic
cross-thread sharing is introduced, but same-owner threads can reference the same ledger without
duplicating/rebinding ciphertext. Deleting a thread leaves the independent ledger; unlink its
threads before explicitly deleting a ledger. The ledger's profile reference cascades on owner
deletion; its deferred thread FK permits coordinated deletion within one transaction.

Limits:
60 sources, 100 claims, 10 crawl jobs, 80,000 text characters per source, and 1,500,000 serialized
ledger characters. Provider responses are capped at 4 MiB and calls have deadlines; a turn
allows at most 12 provider calls plus best-effort cancellation of an unpersisted crawl.

## Result and annotation reuse — Locked 2026-10-10

The general [Exa terms linked from its website](https://exa.ai/assets/Exa_Labs_Terms_of_Service.pdf)
were reviewed on 2026-10-10. Section 4.2(a) restricts copying and derivative use except browser
display caches or express permission; additional account agreements can control. Those public
terms do not clearly authorize application caching. **Exa result reuse and Exa-derived annotation
reuse stay disabled unless an administrator records applicable written permission.** This is a
permission gate, not a claim that arbitrary publisher content is licensed. Research evidence
archiving and persisted transcripts also require rights under the applicable agreements; this
cache does not grant them or change their existing retention behavior.

`RESEARCH_REUSE_POLICY` is an optional server-only JSON setting. It defaults to no grants.
Invalid/oversized policies fail closed. Each grant must reference reviewed provider, publisher,
and (for annotations) model-output agreements permitting stored evidence/notes and the specified
reuse. Do not configure agreements requiring strict deletion deadlines: this implementation
expires reuse eligibility and prunes cache entries on later writes, but is not a timed deletion
service for the evidence archive. Never infer permission from an API key, public access,
robots.txt, or a provider's own cache. No model or chat setting can grant rights.

Example shape only; these example references are not permission to enable a real deployment:

```json
{
  "version": 1,
  "grants": [
    {
      "provider": "docling",
      "reference": "reviewed permission record for owned documents and generated notes",
      "expiresAt": "2026-12-01T00:00:00.000Z",
      "urlPrefixes": ["https://your-owned-domain.example/research/"],
      "purposes": ["annotation"],
      "maxTtlSeconds": 3600
    }
  ]
}
```

Allowed providers are `exa`, `firecrawl`, and `docling`; purposes are `retrieval` and `annotation`.
Origins are exact: no implicit subdomains or wildcard host matching. A path ending in `/`
allows only that subtree; other paths match exactly. Query restrictions on a prefix must match.
Every returned source must qualify, including redirected/result URLs. Revoked, expired or changed
grants reject old entries immediately. Approval references remain in server configuration; only
their digest is stored. No real agreement text or credentials belong in this public repo.

Exa search reuse keys include the exact query and every domain/date/category/result-count control.
Page reuse keys retain path, case and query; only URL fragments are removed. Eligible pages are
reused individually even across different URL batches. Successful search entries last at most
5 minutes, page entries 1 hour, annotations 24 hours; grant TTL/expiry can shorten each. Failures,
empty results and unsuccessful URL statuses are not cached. Cache entries hold snapshot ids,
not duplicate source text. Permission and ownership are rechecked on reads. Same-process,
same-owner/thread requests serialize and recheck the durable cache to avoid duplicate spends;
there is no distributed request lock across server instances.

`fresh:true` bypasses local retrieval reuse, invalidates the older entry and fetches again. Exa
Contents uses its documented `maxAgeHours: 0` for fresh requests and `1` for ordinary misses,
replacing deprecated `livecrawl`. [Exa's cache control](https://exa.ai/docs/reference/get-contents)
controls Exa's cache, not rights to ours and not a guarantee of free calls. A local hit preserves
the immutable snapshot's capture time and does not consume a provider call or external-fetch
limit. UI results say when saved sources were reused.

`research_annotations` must be called before generating notes. Its context must include the
exact assignment and annotation requirements; `research_publish.annotationContext` must match.
Keys also include captured text/page SHA-256, provider, URL, scope flags, server-selected model,
annotation prompt version and a hash of the supplied generation messages/system prompt. Missing
model identity disables annotation reuse. Takeaways remain interpretations; whole report
conclusions and claims are never silently reused for a different question. Notes remain
inspectable in chat; a lookup never invokes an LLM itself.

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

The focused tests are `tests/unit/lyra-research.test.ts`, `tests/unit/lyra-research-ledger.test.ts`,
`tests/unit/lyra-research-reuse.test.ts` and `tests/unit/lyra-research-ui.test.tsx`.
Provider traffic is mocked; tests do not spend service
credits or start Docling. They cover request contracts, immutable evidence, quote/page checks,
concurrent writes, encrypted ownership, background tool persistence, report generation and
on-demand reading, reuse permission/expiry/freshness and exact annotation identity. All tool input
schemas serialize to an explicit object root; crawl action fields are validated server-side.
This prevents provider errors such as `tools.5.custom.input_schema.type: Field required`, which
occur before research provider keys or database access. Live service access and an applied
migration are separate deployment checks.
