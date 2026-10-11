# Independent research ledgers and permission-controlled reuse

**Date:** 2026-10-10

Research evidence now lives in `research_ledgers`, referenced by `threads.research_ledger_id`.
A composite owner/id foreign key, table RLS and owner filters protect both sides of the link.
The encryption binding uses ledger id so another same-owner reference does not require copying
the payload. Revision checks protect concurrent edits; null-FK attachment handles initializer
races. A migration backfills old ciphertext with a temporary encryption-context marker.

Retrieval reuse stores immutable snapshot references in the encrypted ledger, and annotation
reuse stores bounded generated source notes there. Lookup keys include request controls or
source version/model/prompt/generation context. Expiry, refresh and permission revocation are
checked before returning an entry. Exa local reuse is disabled under unverified permissions;
server configuration must record reviewed provider/publisher/model-output rights. No shared
cross-owner response cache or new package/service is introduced.

The crawl tool now uses an object-root input schema with action-dependent server validation.
A provider-boundary test serializes every tool schema, preventing the missing root `type`
error caused by the previous top-level discriminated union.

Operational setup, term-review links and retention limits are maintained in the
[research guide](../../../lib/llm/subagents/research/README.md).
