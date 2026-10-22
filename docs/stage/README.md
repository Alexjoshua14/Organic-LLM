# Stage implementation

`/stage` is authenticated. It uses the existing Clerk identity, Supabase chat store,
model catalog, plan budgets, and Upstash Redis connection. No new service or dependency
is required. Encryption requires the existing `ORGANIC_LLM_ROOT_SECRET` and optional
key registry configuration.

## Code map

- `components/stage/`: stage, arrangement editor, conversation/activity panels, independent
  live chat widgets. React keys are stable widget IDs; layout updates retain chat state.
- `lib/stage/schema.ts`, `layout.ts`, `reconcile.ts`: bounded component registry, placement,
  and reconciliation against the designer's original snapshot.
- `lib/stage/agent.ts`, `design.ts`: separate central conversation and background designer.
- `lib/stage/store.ts`: authenticated callers' owner-scoped encrypted snapshot log and head.
- `app/api/stage/`: state, mutation, conversation, event pagination, and chat hydration.

## Layout contract

Coordinates are zero-based internally on a 32 × 32 grid. The arrangement controls show
one-based rows and columns. Components span merged rectangular cells. Validation rejects
out-of-bounds rectangles, duplicate IDs, overlaps, and missing one-cell gutters. The agent
occupies the reserved center rectangle defined by `STAGE_AGENT_RECT`.

The designer can add, update, move, and remove registered pieces. It cannot execute
arbitrary code or supply a chat thread ID. A completed design cannot overwrite a piece
edited since the job started. Existing chat IDs and component kinds remain stable.

Small screens display the pieces in a readable vertical sequence, preserving their saved
grid coordinates. The stage keeps one Organic activity mark. The design uses the existing
[material](../design/liquid-chrome-materials.md) and
[motion](../design/subagent-identity-mark.md) contracts. Functional stage transitions are
140–220ms; reduced motion removes them. Cell gutters remain independent of card insets.

## Persistence and context

Each committed event includes a complete bounded working bundle, revision, timestamp,
cause, model handoff, and available token usage. Working summaries and visible conversation
content are stored; private model reasoning is not requested or stored.

The event envelope uses the existing AES-256-GCM service, with owner and revision bound
as authenticated data. Redis contains ciphertext for the current head and history. A Lua
compare-and-swap appends an event and replaces the head atomically. Hot reads need one Redis
lookup; history is paginated separately. The application does not persist decrypted stage
content in browser storage. Chat widgets use existing encrypted Supabase thread persistence.

Redis history has no application expiry or trimming. Its durability and capacity follow
the configured Redis service; this is not a separate archival backup. No read/write latency
claim is made without deployment measurements.

The conversation selects its next model from the existing fast, balanced, and deep aliases.
The layout designer runs separately after the main response, using the balanced alias.
Static instructions precede bounded context to keep a reusable prompt prefix. This does not
guarantee a provider cache hit. Both paths use existing plan-budget accounting and ZDR.

## Failure behavior

Failed saves are reported; the client retains its draft. Layout conflicts reload the latest
revision. Expired design jobs become retryable failures. Stage API responses are private and
not cached. Request authorization is checked before owner-scoped state or chat access.

Changes to the registry, concurrency rules, and encryption require focused unit coverage.
Use the repository's `bun run lint:check` and `bun run test:unit` commands for validation.

## Thread references

Copy thread writes the canonical thread UUID to the device clipboard immediately and
independently saves it to the signed-in account's recent clipboard (20 entries, 30-day
inactivity retention). The saved clipboard picker works across signed-in browsers and
devices; operating-system clipboard synchronization remains platform controlled.

Pasting a pointer produces a compact eight-word essence card with an explicit fallback
when generation is unavailable. The card links to the source and can seed a new voice
conversation using bounded, quoted partial context. Stage accepts up to three references
per turn; chat and subagents resolve references through an authenticated ownership-bound
tool. Source content cannot grant access to another account's threads.

`/admin/thread-reference-performance` reports p50/p95/p99 from the most recent 512
samples per operation across server instances. Anonymous timings are stored asynchronously
in Redis, with 30-day inactivity retention. Native clipboard latency and network transit
are outside these server measurements. Clipboard inserts use a bounded sorted set;
percentiles are calculated on demand, away from the copy operation.
