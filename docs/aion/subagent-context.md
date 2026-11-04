# Subagent dispatch context

`dispatch_subagent` sends an authored brief and explicitly selected context. The worktable
remains private to the orchestrator; workers receive only the selected material.

## Selection

A string in `bundles` sends the whole saved bundle, preserving the existing interface.
An object selects individual items and optional character ranges:

```json
{
  "agent": "Reed",
  "brief": "Check whether the exporter preserves streaming responses.",
  "bundles": [{ "bundle": "Review kit", "items": [{ "itemId": "it-123456" }] }],
  "items": [{ "kind": "user_message", "messageId": "message-id", "offset": 100, "limit": 500 }],
  "history": "fresh",
  "dryRun": true
}
```

Omitting a bundle object's `items` sends all its items; `items: []` sends only its standing
instructions. `includeInstructions: false` explicitly excludes those instructions. Selection
preserves source order and does not edit the saved bundle. Inline items also accept `offset`
and `limit`. Ranges use JavaScript string length; a range on a supplied quote is relative to
that quote. User quotes are verified against the owned source message. Live output resolves
at dispatch time. Identical attached content from the same source is delivered once; the
manifest records `duplicateOf` for repeated items.

## History and preflight

`history: "continue"` is the default and preserves the recent worker-history prefix.
`history: "fresh"` sends no previous worker messages. `historyMessageIds` selects complete
messages from that worker's recent history in chronological order. IDs are frozen in the
assignment and reloaded when queued work executes; missing selected history blocks execution
instead of substituting newer messages. A fresh run cannot also select history IDs.

Preflight uses the actual persona, registered tool schemas, selected history and assignment.
The existing input limit is 24,000 estimated tokens, with 4,000 reserved for subsequent tool
results. An oversized assignment fails before queueing. No automatic summary call or implicit
history removal occurs. `dryRun: true` returns the same manifest without creating a child,
saving an assignment, queueing work, or consuming a dispatch allowance.

The manifest reports per-item source IDs, original and delivered character counts,
truncation, duplicates, omitted bundle items, selected history, and input-budget components.
Cost estimates show configured uncached and fully cached input scenarios, excluding output
and cache-write charges. They do not predict a cache hit. Completed worker reply metadata
records provider-reported input, cached input and output through `contextUsage`; existing
usage accounting remains authoritative.

## Previews and paging

The preview cap is `WORKTABLE_LIMITS.itemChars` in
`lib/llm/subagents/worktable/types.ts`: **6,000 characters**. Longer items end with:

```text
[TRUNCATED: showing N of M chars. Call read_context_item("<itemId>", offset, limit) for the rest]
```

`deliveredChars` counts content only, excluding the marker. Under-cap content is unchanged.
Full selected originals are retained in the assignment's encrypted message metadata, which
is excluded from model-message conversion. An excerpt retains only that excerpt for paging.
There is no database migration. Storage limits are 120,000 characters per selected original
and 240,000 per dispatch; the existing rendered-context limit is 40,000. Exceeding a limit
returns an error asking for a smaller selection. Previously saved, already clipped worktable
items must be replaced from their original source.

`read_context_item(itemId, offset?, limit?)` returns:

```text
{ itemId, offset, returnedChars, totalChars, nextOffset: number | null, content }
```

Offset defaults to 0 and clamps to at least 0. Limit defaults to 8,000 and clamps to 1–8,000.
An offset past the end returns empty content and `nextOffset: null`. Counts and offsets use
JavaScript string length. The server binds the reader to the calling worker's assignment;
model arguments cannot select a caller, thread, or dispatch. Unknown IDs and another
dispatch's IDs return the same generic unavailable error. A direct conversation with a
worker can page attachments from its latest assignment in the recent thread window.

Attachment previews and page results use structured untrusted-data framing plus a system
instruction to treat embedded instructions as reference content. Framing preserves exact
source strings, so concatenating pages reconstructs the full selected original.
