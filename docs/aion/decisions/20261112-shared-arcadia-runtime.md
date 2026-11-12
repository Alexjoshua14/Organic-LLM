# Aion sandbox uses the shared Arcadia full-turn runtime

**Status:** Accepted — sandbox implementation
**Date:** 2026-11-12

## Context

The presence sandbox had a separate full-turn chat component and handler with a smaller
set of tools than Arcadia. Its mobile and desktop trees mounted separate chats for one
thread, and both registered with the same presence bridge.

## Decision

- Keep `aion` as the request experience and composer settings scope. Resolve it to the
  Arcadia runtime at the shared Chat and `/api/chat` entry points. Other experiences retain
  their existing behavior. Feature tags, thread policy and global providers stay unchanged.
- Replace the standalone Aion chat implementation with a thin adapter around shared Chat.
  The adapter supplies validated client-side archetype tools. Aion's identity appendix and
  archetype tools are added only for Aion orchestrator turns, preserving worker policies.
- Reuse the existing Arcadia multiagent host, board and authenticated thread controls.
  Keep the event bench, tier policy, cheap micro-turn endpoint and budget drawer.
- Keep one conversation mounted across responsive layouts and surface visibility changes.
- Cancel pending micro work when full chat starts or awareness is paused. Abort signals
  reach micro generation. Preserve unacknowledged events and expose request failures.
- Retain `/api/ai/aion` for existing callers; the sandbox now uses `/api/chat`.

This is a sandbox refresh. It adds no global presence provider, persistence schema,
dependency or Cmd+K conversation. Those integration boundaries remain separate work.

## Verification

Regression tests cover runtime selection, archetype commands and memory payload validation,
debounce cancellation, failed requests, full-turn priority and event acknowledgement.
The existing Arcadia and Aion suites remain part of the normal test commands.
