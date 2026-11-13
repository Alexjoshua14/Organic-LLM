# Explicit source context

`/api/continuity` discovers owned Speak title/date metadata or current Stage notes, diagrams
and recipes. It calls direct source readers, never the Stage GET recovery route. Search is
paginated in six-result pages. Dates mean source update time; title search is not full-text
or semantic retrieval. Chat widgets and historical Stage snapshots are excluded.

An interaction belongs to one authenticated owner and one surface. Selection records contain
source references/versions, a revision and up to 64 replay receipts, encrypted with owner,
interaction ID and schema version as authenticated data. Redis keys hash the owner ID.
Reads and selections refresh the 24-hour inactivity TTL using CAS. Expired records require
explicit selection again; there is no account-global fallback.

Source authorization/version checks run on selection (including receipt replay) and on content
compilation. Compare-and-set applies a selection only at its expected revision. A duplicate
request returns its original selection receipt; a changed payload under the same request ID
fails. Once a turn reads its binding, later selections apply to subsequent turns. A binding
records the source reference and selection revision, never the selected source text.

Speak applies the bounded packet at mint time to a new transcript and stores the binding on
its session and persisted messages. Connection recovery revalidates the original source;
missing/changed sources fail instead of being silently omitted. Typed Stage turns use the
existing central executor and store the binding on both canonical messages. Navigation and
voice Stage calls keep their existing paths; this picker is disabled during a live call.

The context packet is partial quoted data. Its estimated token budget is under 1,800 tokens.
Selecting context does not move messages, restore Stage state, resume workers, or isolate the
Stage account-wide summary. A Stage revision change requires source reselection even when the
selected artifact itself was unchanged; that is a conservative freshness guard.

The first release has no model router, historical Stage search, embeddings, brief updater or
live provider-context reset. Realtime item identity/late-tool changes are separate work and are
not made safe merely by this selection store.
