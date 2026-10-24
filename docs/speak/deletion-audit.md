# Speak — unused-path audit

Reviewed **2026-09-12**, against the working tree based on `73cae7f`.
The audit below records the dependencies before removal. **Cleanup completed on 2026-09-12:**
all ten source files in the first three tables and `tests/integration/tts-stream-route.test.ts`
were deleted. The orb's phase type now comes from `hooks/use-realtime-voice.ts`. Deleted paths
are shown as code rather than links. For the active session architecture, see
[current Realtime setup](./current-realtime-setup.md).

**Original finding: 10 source files, approximately 1,884 lines, were candidates for removal** without
removing the currently mounted Live or Read Aloud experiences. Six are a disconnected TTS UI
cluster, two belong to the superseded voice-turn pipeline, and two are legacy HTTP endpoints.
The endpoint candidates require a distinction: no current application callers were found in
this repository. The three retired HTTP routes are no longer implemented. Production traffic
and external callers were not checked before their authorized removal.

## Disconnected TTS UI: remove together

| File | Evidence |
|------|----------|
| `components/tts/UnifiedPlayback.tsx` | No importers. Old segmented-audio player. |
| `components/tts/SegmentManager.tsx` | Only imported by `UnifiedPlayback`, for its `TextSegment` type. No mounted segment manager. |
| `components/tts/ClipBrowser.tsx` | No importers. Old saved-clip browsing UI. |
| `lib/tts/clip-store.ts` | Only imported by `ClipBrowser`; no other clip readers or writers found. |
| `components/tts/GenerationProgress.tsx` | No importers of the module or consumers of its `GenerationProgress` / `InlineProgress` exports. |
| `components/tts/TokenUsageDisplay.tsx` | No importers of the module or consumers of its regular / compact display exports. |

These six files total **1,258 lines**. The current Speak stages do not mount any of them.
Deleting the clip-store module would remove code, not erase existing browser IndexedDB data;
there is no reason to include a browser-data purge in source cleanup.

## Superseded voice-turn pipeline: remove with one import change

| File | Evidence / prerequisite |
|------|-------------------------|
| `hooks/use-live-voice.ts` | `useLiveVoice()` has no callers. The only importer is the active `VoicePresenceOrb`, importing the `LiveVoicePhase` type. Point that type import at `hooks/use-realtime-voice.ts`, which already exports the same union, before deleting this file. |
| `app/api/ai/speak/turn/route.ts` | Explicitly deprecated. Its only repository fetch caller is the unused hook above. Current Live calls the `/speak/realtime/*` routes instead; Read Aloud does not use this fallback. |

These two files total **322 lines**. The old path uses browser speech recognition followed by
a text-generation HTTP request. It is not a runtime fallback selected by the current shell.

Keep [`lib/web-speech-recognition.ts`](../../lib/web-speech-recognition.ts): it is also imported
by [`composer-mic-button.tsx`](../../components/chat/composer-mic-button.tsx) and the shared
[`prompt-input.tsx`](../../components/third-party/ai-elements/prompt-input.tsx).

## Legacy TTS endpoints: no current app callers found

| File | Evidence / accompanying cleanup |
|------|----------------------------------|
| `app/api/ai/tts/transform/route.ts` | No application fetches or imports found. Described by the superseded Speak docs. Its underlying `transformTextToSpeechFriendlyV2` function is still used by `/api/ai/tts-v2` and must stay. |
| `app/api/ai/tts/stream/route.ts` | No application fetches found. Only direct importer is `tests/integration/tts-stream-route.test.ts`; remove that endpoint-specific test with the route. |

These two routes total **304 lines**. They can be retired as app-internal legacy interfaces;
the repository alone does not establish whether anyone calls their URLs outside the app.

Do not remove [`tests/helpers/mock-tts.ts`](../../tests/helpers/mock-tts.ts) wholesale. It also
supports active audio/alignment unit tests. Likewise,
[`tts-real-fixture.test.ts`](../../tests/unit/tts-real-fixture.test.ts) tests the shared
`decodeAudioBase64` implementation even though its fixture documentation mentions the old
endpoint. Audit SSE-only helper/test sections individually. The copied legacy conversion tests
in [`tts-audio-roundtrip.test.ts`](../../tests/unit/tts-audio-roundtrip.test.ts) also warrant a
separate coverage review; a stale comment alone is not evidence that all audio tests are obsolete.

## Still reachable: removal would retire a feature

| Path | Current connection |
|------|--------------------|
| [`app/speak/v2/page.tsx`](../../app/speak/v2/page.tsx) + [`ttsButton-v2.tsx`](../../components/tts/ttsButton-v2.tsx) | Next.js demo route with its own TTS button. The URL also appears in the core assistant's [`pageMetadataObjects`](../../lib/llm/core/coreToolKit.ts), navigation enum, and returned instructions. Retiring the demo requires updating those references and the fixture guide. |
| [`app/sandbox/tts/page.tsx`](../../app/sandbox/tts/page.tsx) + [`app/api/ai/speech/route.ts`](../../app/api/ai/speech/route.ts) + [`ttsButton.tsx`](../../components/tts/ttsButton.tsx) | Sandbox page calls `/api/ai/speech` and mounts `TTSButton`. These form a reachable demo, independent of Realtime. |
| [`ReadAloudStage.tsx`](../../app/speak/_components/ReadAloudStage.tsx) | Mounted by `SpeakShell` when the user switches modes. Its chunking and token-limit helpers remain used. |
| [`lib/tts/pinned-to-speak.ts`](../../lib/tts/pinned-to-speak.ts) | Chat's [`AssistantMessageActions`](../../components/chat/assistant-message-actions.tsx) still calls `addPinnedFromChat` and offers an “Open Speak” action. The current Speak stages do not call the list/get functions. This is an active write flow with no current reading UI, not an unused module. |

Whether to retain Read Aloud, the demos, or the pin flow is outside the dead-code finding.
If pinning is retired, its button, handler, toast, storage module, and test expectations need
to be handled together. No persistence or resume design is assumed here; unresolved product
direction remains in `organic-llm-hub/speak/open-questions.md`.

## Shared infrastructure to preserve

| Code | Active consumers |
|------|------------------|
| [`hooks/use-tts.tsx`](../../hooks/use-tts.tsx), [`lib/context/tts-context.tsx`](../../lib/context/tts-context.tsx), [`tts-dock-layout.tsx`](../../components/tts/tts-dock-layout.tsx) | Chat read-aloud actions, Read Aloud mode, and TTS demos. |
| [`app/api/ai/tts-v2/route.ts`](../../app/api/ai/tts-v2/route.ts) | `useTTS` requests this endpoint. It is the active streaming-TTS path. |
| [`app/api/ai/tts/route.ts`](../../app/api/ai/tts/route.ts) | Rabbit Hole playback and Strata's elaborated-TTS bar fetch this endpoint. |
| [`lib/llm/text-to-speech.ts`](../../lib/llm/text-to-speech.ts) | The V2 transformation is called by the active `/api/ai/tts-v2` route. |
| [`lib/tts/token-calculator.ts`](../../lib/tts/token-calculator.ts) | Read Aloud chunking, assistant-TTS text preparation, GenUI `AudioSnippet`, and a type import in `/api/ai/tts-v2`. |
| [`lib/tts/audio-cache.ts`](../../lib/tts/audio-cache.ts) | Browser audio cache used by `useTTS`. Different store from the disconnected clip library. |
| [`lib/tts/tts-v2-audio-cache.ts`](../../lib/tts/tts-v2-audio-cache.ts) | Server TTS cache; also reused by memory-search caching. |
| [`lib/llm/tts/helpers.ts`](../../lib/llm/tts/helpers.ts), [`lib/schemas/tts.ts`](../../lib/schemas/tts.ts) | Active streaming/alignment processing and its tests. |
| `app/api/ai/speak/realtime/`, `hooks/use-realtime-voice.ts`, Speak compiler/executor/prompt/schema/limiter | The current Live implementation. An overhaul may replace these, but they are not unused. |

The shared GenUI renderer, web-preview component, and authentication/rate-limit utilities
also remain dependencies of active features. None of the first ten deletions justifies
removing an entire TTS directory or its provider packages.

## Smaller export cleanup and documentation

After removing the old UI, these exports in `lib/tts/token-calculator.ts` have no remaining
external consumers in the searched source: `calculateSegmentedCost`, `formatCost`,
`formatDuration`, `formatAudioDuration`, and `formatNumber`. `PREVIEW_COST_PER_CHAR` serves
the obsolete segmented-cost implementation. `getModelInfo` and `generateSkipPlaceholderText`
already have no external consumers. Preserve the shared calculator, segmentation function,
and types still used by active callers.

In `lib/llm/text-to-speech.ts`, `textToSpeech()` has no callers. The older
`transformTextToSpeechFriendly()` is referenced by `tests/time-trials/llms.ts`, while the V2
function is active. These are candidates for function-level pruning, not whole-file deletion;
retiring the V1 benchmark is a separate choice.

Keep the two superseded Speak architecture/workflow documents flagged as historical, per the
[maintenance protocol](../hub/maintenance-protocol.md#working-rules). If route files are deleted,
annotate historical references so their old code paths are not mistaken for current entry
points. [`tests/fixtures/README.md`](../../tests/fixtures/README.md) needs its claim that `/speak`
calls `/api/ai/tts/stream` corrected. [`docs/tts-token-tracker.md`](../tts-token-tracker.md) also
describes the unused token-display UI and should be marked historical when that code is removed.

## Original audit evidence and verification

- Searched source symbols, module names, fetch URL literals, tests, docs, and route references.
- Used the installed TypeScript resolver to inspect imports across **1,598 source files**,
  including relative and `@/` imports, and manually checked the remaining type-only edge.
- Treated Next.js page/route files as entry points even when no module imports them.
- Excluded generated output, dependency directories, and unrelated private/worktree copies
  from the application reachability finding. This was static inspection, not production telemetry.
- `bun run test:unit`: **1,162 passed, 0 failed** across 211 files.
- `bun run lint:check`: **72 errors and 4,775 warnings** in existing files, including local
  worktree copies traversed by ESLint. This audit changed documentation only.

## Removal scope

The completed cleanup covers the six-file UI cluster, old hook/turn pair, two legacy TTS
endpoints, and the endpoint-specific integration test. Historical docs and fixture/test
comments now distinguish the removed transport from current Speak. Shared TTS code, demos,
Read Aloud, pinning, and the smaller export-cleanup candidates remain unchanged.

Removal verification:

- `bun run test:unit`: **1,162 passed, 0 failed**.
- `bun run test:integration`: **93 passed, 0 failed**.
- Import scan across **1,587 source files**: no imports targeting the deleted modules.
- `bun run lint:check`: **69 existing errors and 4,749 warnings**, down from 72 errors
  and 4,775 warnings before removal. Comparison with the audit baseline found no new errors.
- `git diff --check`: passed.
