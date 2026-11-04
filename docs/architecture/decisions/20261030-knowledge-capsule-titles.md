# ADR: Knowledge-capsule thread titles (experimental)

**Status:** Accepted  
**Date:** 2026-10-30  
**Issue:** COA-429

## Context

Sidebar thread titles today use a two-step legacy pipeline (summarize → short noun-phrase title). Product direction for an experimental mode treats titles as **knowledge capsules**: tight phrases that convey a thread’s contents, needs, or notifs, with an explicit slot grammar.

## Decision

1. Add `experimentalKnowledgeCapsuleTitles` to client user settings (localStorage; Experimental section alongside other Coalescence-mode experiments).
2. When the flag is on, `generateChatTitle` / `ensureChatHasTitle` use a **separate** summarizer prompt and short-title prompt, then parse/validate against:
   - action ≤ 2 words
   - subject ≤ 2 words
   - additional ≤ 2 words
   - combined ≤ **5** words (spirit ~4; enforce 5)
3. Soft-repair when the model drifts (truncate slots, drop trailing words from additional → subject → action). Fail soft to a short fallback rather than leaving the thread untitled.
4. Clients pass the flag on chat POST and generate-title POST (settings are device-local today).
5. Ship an admin sandbox lab at `/sandbox/prototypes/knowledge-capsules` to iterate prompts and grammar without changing the legacy path.

## Consequences

- Legacy titles remain the default; no migration of existing titles.
- Rate limits are shared with other title generation.
- Grammar and prompts live in `lib/llm/knowledge-capsule-title.ts` so the lab and production path stay aligned.
