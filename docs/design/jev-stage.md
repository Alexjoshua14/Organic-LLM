# Jev Stage prototype

Lab: [`/sandbox/prototypes/jev-stage`](../../app/sandbox/prototypes/jev-stage/page.tsx).
Real `/stage` and `/api/stage` are **untouched**. This fork keeps its own Redis namespace
(`jev-stage:…`) so it can promote later into Stage without a cutover surprise.

## Intent

Jev is the first hop on every turn — an intelligent switch, not the responder. It ranks:

- **Direct tools** that patch Stage programmatically (view, captures, recall, designer brief,
  specialists, memory search, web search) with no LLM phrasing when the tool owns the surface.
- **LLM tools**: **Respond** (streamed, $0.20 input / $0.10 output budgets) and **Orchestrate**
  (Arcadia-shaped system prompt + tools, including `dispatch_subagent`).

Downstream uses an NDJSON event stream (route → delta/patch → done), analogous to Arcadia’s
custom stream writer / AIData side channel.

## Turn loop

After Jev routes, execution is a bounded step loop (`JEV_STAGE_TURN_MAX_STEPS`):

1. Run the selected action (direct tool, Respond, or Orchestrate).
2. If a direct tool (or empty Orchestrate) leaves no Conversation line for this request,
   fall through to **Respond**.
3. Respond / Orchestrate allow up to eight AI SDK steps so lookups and Stage tools have
   room before the closing reply. Respond still applies its existing input and output budgets.
4. A final safety reply is written if the turn would otherwise complete with nothing visible.
5. The server sends heartbeats while the turn runs. When the stream loses contact,
   the client checks for the saved turn by request ID without sending the message again.
6. Designer jobs reuse Stage's generator and layout reconciler against the prototype store.
   Stage polls for queued and working jobs, shows progress, and opens Overview when new
   pieces land from the Organic view. Failed jobs offer a retry. Jev ranks the authorable
   gen UI formats from the design brief and the designer receives up to three relevant schemas.
   Plain source examples use fenced Markdown in a note. Diff blocks are for patches and
   before/after comparisons. If ranking is unavailable, the designer receives the full catalog.

## Code map

| Path | Role |
|------|------|
| `lib/jev-stage/` | Router, budgets, direct tools, respond/orchestrate streams, store, turn |
| `app/api/prototypes/jev-stage/` | GET bundle, POST NDJSON turn / reset, eval POST |
| `components/jev-stage/` | Hook + insight panel |
| `docs/migrations/jev_stage_turn_eval.sql` | Lean Supabase eval table |

## Generated piece hierarchy

- Start with the answer or action. Use short sentence-case section headings and separate
  Markdown paragraphs. Keep each section about one thing the reader needs to understand or do.
- Present action mappings as a list with a bold action and an inline-code API call. Ordered
  lists describe steps. Diagrams show meaningful branches or dependencies. A timeline is for
  phases, and a decision matrix is for comparing options against criteria.
- Introduce a code example with a descriptive heading and, when it matters, a filename on its
  own line. Leave a blank line before the language-tagged fence. Use a full-width piece for
  longer code and give substantial explanation a companion piece. Diff blocks show patches.
- During a layout revision, preserve facts, code behavior and sources. Update existing pieces
  that serve the same purpose.

For the SDK example, use a **Chat controls** section with separate **Send**, **Stop**, and
**Retry** rows. Follow it with one sentence about what the SDK handles. Give the code its own
**Chat screen** heading and put `app/page.tsx` on a line before the fence.

Stage applies this hierarchy across content types. A recipe uses a recipe piece with quantities
and ordered steps. An architecture walkthrough pairs a diagram of components and connections
with a short note on assumptions or tradeoffs. For a deeper request with an existing specialist
artifact, Stage introduces the result and links to it. Framing requires a known, embeddable URL.

## UI eval for AI SDK controls

Send this exact prompt in a disposable Jev Stage session:

> Show me the Vercel AI SDK controls / usage of it.

Review the finished Stage on desktop and phone. Score each row as met, partial, or missed.
Save the result in the turn's Insight eval note with the viewport, selected model, and the
first thing a reader struggled to find. A pass meets every row.

| Check | What the reviewer should see |
|---|---|
| Controls at a glance | Send, Stop, and Retry each have a distinct row. The reader can tell which API each calls, when it is available, and what happens on failure. |
| Request lifecycle | The UI explains submitted, streaming, ready, and error states. It distinguishes the SDK's state and transport from the buttons and rendering the app owns. |
| Usable examples | A minimal client and server example are separately labeled, use compatible imports and message shapes, and show how the client connects to the streaming route. Code is copyable. API claims link to official docs. |
| Reading order and layout | The controls are visible before a long code sample. Headings, lists, filenames, and code are visually distinct. Pieces fit the phone width, and toolbar or composer controls leave the content accessible. |
| Completion | Stage visibly progresses from receiving the request to placing the pieces. A queued acknowledgment by itself is a miss. |

Then send “Improve the UI please, and show me again.” Review whether headings and layout
improve while the factual content, example behavior, and source links survive, without
duplicate pieces.

Reference checks: [useChat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat),
[Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot), and
[Transport](https://ai-sdk.dev/docs/ai-sdk-ui/transport).

Two companion prompts check that the UI can change formats:

- “Show two quick chickpea dinners for two, with quantities and steps.” Expect two identifiable
  recipe pieces with serving sizes, measured ingredients, and steps in order.
- “Diagram how a web client, API, worker queue, and database handle a background export.”
  Expect a diagram with named components and labeled handoffs, plus a short explanation of
  how the client learns that the export is ready.

## Sent message

The prototype echoes a submitted message beneath Organic while the turn runs. The two-line
preview opens in a scrollable popover when clipped. Organic’s action phrase uses Arcadia’s
processing shimmer. Route, fallback, model and tool updates
come from the turn stream. Once the reply is saved, the full message is available in
Conversation. A failed turn leaves the echo visible until retry or reset.

## Insight panel

On desktop, Conversation opens in a recessed right column and Stage adjusts its width. The
fixed-height Insight note can move within the Stage area by dragging its grip or using the
arrow keys on the focused grip. Home returns it to its initial position. On mobile, the Insight sheet opens from the Stage toolbar. Pieces stack in a full-width reading column.

Insight follows the latest interaction by default, including the in-flight turn. Paging back
pauses following. The Follow latest toggle or paging to the newest turn resumes it.

- **Pipeline** shows the route, top-three probabilities, confidence floor, tool results, step
  timing, spend, and fallbacks. Older turns use stored traces when available.
- **Context** shows the inputs captured for Jev, Respond, Orchestrate, and linked Designer attempts, plus expandable tool
  outputs, the message packing window and model usage. Input segment counts are estimates.
  Tool definitions list names and descriptions, and long stored text is capped. Cache reads
  are attributed to the model call because providers report totals at that level.
- The footer shows the turn's totals and evaluation controls. Context is kept with the
  lab’s authenticated, encrypted turn record.

## Confidence floor

`JEV_STAGE_CONFIDENCE_FLOOR = 0.45` (owner, 2026-11-21; gates direct tools and Orchestrate only: a top pick of `respond` always runs as a normal Jev decision) in `lib/jev-stage/constants.ts`. Tunable; threshold research
is out of scope for this lab.

## Promote recipe (later)

1. Capture legacy Stage screenshots.
2. Point Stage’s turn path at `runJevStageTurn` (or merge namespaces).
3. Keep insight panel opt-in until product accepts it.
4. Run the eval migration in production Supabase.
5. Bump app semver; do not delete the lab until the owner says so.
