# Budget-first subagent dispatch

Date: 2026-10-10. Status: implemented.

The orchestrator previously passed its selected chat model to every worker. Background workers
allowed 100 model steps and requested up to 500,000 output tokens per step. This made delegation
amplify the cost of the parent model and left tool loops with large allowances.

Automatic selection now uses a server-owned worker policy without an additional classifier
call. Economy uses the catalog's Haiku alias. Standard uses Sonnet and requires a task-specific
`modelReason`; assignments and tool results record the model actually queued. Explicit sends
to a subagent and direct chats retain the user's selected model. The configured models' IDs,
tool-use support and base prices were checked against the
[Gateway catalog](https://ai-gateway.vercel.sh/v1/models) on this date; no live generation was
needed for verification. Selection is an allowlist, not a runtime cheapest-price auction.

The prompt favors completing routine work in the current thread, reusing relevant outcomes,
and starting one suitable specialist when its tools, expertise or isolated deliverable justify
the added call. Dispatch enforces:

- Two successful dispatches at most per turn. After the first, `additionalDispatchReason` must
  explain the independent work another specialist adds.
- One automatic dispatch between user messages, counted by the existing worktable reservation
  or message-history fallback. User messages restore that allowance.
- No new orchestrator-authored assignment to an effectively working specialist. Identical brief
  and context cannot be sent to another specialist in the same turn.
- The fallback router consolidates one specialist's thoughts into one run, leaves other work
  visible for an inline answer, and uses an economy worker. Its routing display reflects work
  that was not dispatched.

Worker execution is bounded separately: eight steps for ordinary workers, twelve for research,
4,000 requested output tokens per step, and 16,000 across the run. Previous steps' reported
output totals include reasoning; absent usage conservatively consumes the per-step allowance.
The next request's cap shrinks to the remaining allowance. The last step disables tools and
asks for the result so far, including unfinished work. A per-step 24,000-token input estimate
includes instructions, serialized messages and tool schemas; oversized context fails explicitly
before the provider call. Runs have a three-minute deadline and one SDK retry at most.

These limits compose with the existing plan-budget gate and per-step usage recording. They do
not establish an exact dollar ceiling: token estimation varies by model, retries can cost money,
and research providers and nested tools have separate charges and limits. Already queued jobs
retain their recorded model; currently running jobs are not canceled by this change.

Busy checks are reads of persisted status and dispatch calls serialize within a turn. This is
not a new cross-process reservation system. Identical completed work across different turns is
handled by the reuse instruction, not a permanent result cache. Existing thread and queue
serialization remain in use.

Verification covers model selection, justified upgrades and second dispatches, duplicate/busy
guards, automatic allowances, legacy routing, input/output bounds, and real SDK tool loops with
mock provider responses to confirm that plan gates and metering remain active.
