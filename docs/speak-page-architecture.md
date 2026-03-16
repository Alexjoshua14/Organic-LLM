# Speak Page — Architecture & Data Flow

## Overview

The `/speak` page converts text to speech using a multi-step pipeline:
**Input → (optional) Transform → Generate → Playback**

It uses **Server-Sent Events (SSE)** for streaming generation progress and receives
the **complete audio as a serialized `Uint8Array` inside JSON** (not as binary streaming).

---

## Component Tree

```
SpeakPage (app/speak/page.tsx)
├── <textarea>                      — user input
├── SegmentManager                  — split text into paragraphs, toggle generate/skip
├── GenerationProgress              — progress bar during generation
├── UnifiedPlayback                 — audio playback UI
│   └── <audio ref={audioRef}>      — native HTML audio element
└── ClipBrowser                     — saved clips (IndexedDB)
```

---

## State Machine (DisplayMode)

```
input ──┬──> review ──┬──> segments ──> generating ──> playback
        │             └──> generating ──> playback
        ├──> segments ──> generating ──> playback
        └──> generating ──> playback
                │
          (transforming)  ← optional sub-step within generating
```

| Mode           | What's shown                                |
| -------------- | ------------------------------------------- |
| `input`        | Textarea + model selector + action buttons  |
| `review`       | Enhanced text preview (after LLM transform) |
| `segments`     | Paragraph-level segment manager             |
| `transforming` | Progress indicator (LLM text transform)     |
| `generating`   | Progress indicator (TTS audio generation)   |
| `playback`     | UnifiedPlayback with `<audio>` controls     |

---

## Data Flow — Step by Step

### 1. Text Entry → Segmentation

```
User types text
       │
       ▼
inputText (state)
       │
       ├──(Simple)──────> handleSimpleGenerate()
       │                    Creates 1 TextSegment { id, originalText, audioUrl: null }
       │                    Calls generateSegment(id, [segment])
       │
       ├──(Segmented)───> handleSegmentText()
       │                    splitTextIntoSegments(text, "paragraph")
       │                    Creates N TextSegments
       │                    displayMode → "segments"
       │
       └──(Review)──────> handleReviewEnhancedText()
                            POST /api/ai/tts/transform  { text }
                            Returns { transformedText }
                            displayMode → "review"
                              └──> handleGenerateEnhancedWhole()  (1 segment)
                              └──> handleSplitEnhancedText()      (N segments)
```

### 2. `TextSegment` Shape (the central data structure)

```typescript
type TextSegment = {
  id: string; // unique ID
  index: number; // position in list
  originalText: string; // raw user text
  processedText: string | null; // LLM-enhanced text (if transformed)
  status: SegmentStatus; // "pending" | "generating" | "generated"
  audioData: Record<number, number> | null; // ⚠️ serialized uint8array from SSE
  audioUrl: string | null; // blob: URL for playback
  generationStatus: "generate" | "skip" | "preview";
};
```

### 3. Audio Generation (generateSegment)

```
generateSegment(segmentId)
       │
       ├──(if processText && no processedText)
       │     POST /api/ai/tts/transform  { text: originalText }
       │     Updates segment.processedText
       │
       ▼
POST /api/ai/tts/stream
  { text, model, segmentId }
       │
       ▼ (SSE stream)
┌──────────────────────────────────────────────────────┐
│  Server (app/api/ai/tts/stream/route.ts)             │
│                                                      │
│  1. generateSpeech({ model, text, voice })           │
│     → Vercel AI SDK → ElevenLabs/OpenAI              │
│     → Returns: audio.uint8Array (binary)             │
│                                                      │
│  2. Converts uint8Array → Record<number,number>      │
│     via uint8ArrayToRecord()                         │
│     ⚠️ This is {0: 73, 1: 68, 2: 51, ...}          │
│     i.e. a plain object with numeric keys            │
│                                                      │
│  3. Sends SSE events:                                │
│     data: { type: "progress", progress: 50 }         │
│     data: { type: "complete", audioData: {...} }     │
│                                                      │
│  ⚠️ The ENTIRE audio is in one "complete" event     │
│  as a JSON-serialized object (not binary streaming)  │
└──────────────────────────────────────────────────────┘
       │
       ▼ (client receives "complete" event)
┌──────────────────────────────────────────────────────┐
│  Client (page.tsx — generateSegment)                 │
│                                                      │
│  1. Parses JSON → data.audioData                     │
│     data.audioData is Record<number, number>         │
│                                                      │
│  2. uint8ArrayToBlob(data.audioData)                 │
│     → new Uint8Array(Object.values(audioData))       │
│     → new Blob([uint8Array], {type: "audio/mpeg"})   │
│                                                      │
│  ⚠️ POTENTIAL ISSUE:                                │
│  Object.values() does NOT guarantee numeric key      │
│  order in all engines. For a Record<number,number>   │
│  with keys "0","1","2"... V8 does preserve order,    │
│  but this is an implementation detail, not spec.     │
│                                                      │
│  3. URL.createObjectURL(blob) → blob:...url          │
│                                                      │
│  4. setSegments(prev => prev.map(s =>                │
│       s.id === segmentId                             │
│         ? { ...s,                                    │
│             status: "generated",                     │
│             audioData: data.audioData,  ← raw obj    │
│             audioUrl: url               ← blob URL   │
│           }                                          │
│         : s                                          │
│     ))                                               │
│                                                      │
│  5. setDisplayMode("playback")                       │
└──────────────────────────────────────────────────────┘
```

### 4. Playback (UnifiedPlayback)

```
segments (prop from SpeakPage)
       │
       ▼
UnifiedPlayback
       │
       ├── generatedIndices = segments with status "generated" && audioUrl
       │
       ├── displayIndex = first generated segment (or currentSegmentIndex)
       │
       ├── currentSegment = segments[displayIndex]
       │
       ├── hasCurrentAudio = currentSegment.audioUrl && status === "generated"
       │
       ├── <audio
       │     src={hasCurrentAudio ? currentSegment.audioUrl : undefined}
       │     controls
       │   />
       │
       └── useEffect: when currentAudioUrl changes → audioRef.current.load()

Audio element lifecycle (expected):
  src set → load() → loadstart → loadedmetadata → loadeddata → canplay → canplaythrough
                                                                   ↓
                                                              user clicks play
                                                                   ↓
                                                          play → playing → ended
```

---

## Identified Issues & Suspects

### 🔴 Issue 1: `readyState` stuck at 2 (HAVE_CURRENT_DATA)

**Observed**: `loadedmetadata` fires (duration OK), `loadeddata` fires (readyState=2),
but `canplay` (readyState=3) and `canplaythrough` (readyState=4) never fire.

**readyState meanings:**
| Value | Constant | Meaning |
|-------|-----------------------|--------------------------------------------|
| 0 | HAVE_NOTHING | No data |
| 1 | HAVE_METADATA | Duration/dimensions known |
| 2 | HAVE_CURRENT_DATA | Data for current position, not enough to play |
| 3 | HAVE_FUTURE_DATA | Enough data to start playing |
| 4 | HAVE_ENOUGH_DATA | Enough data to play through without buffering |

**Why this could happen:**

1. **Blob is corrupt or truncated** — the `uint8ArrayToBlob` conversion lost or reordered bytes
2. **MP3 framing issue** — the blob has valid headers (hence metadata) but the frame data is garbled
3. **Browser needs a range-request-capable source** — blob URLs should work, but worth verifying

### 🔴 Issue 2: `uint8ArrayToBlob` uses `Object.values()` on a numeric-keyed object

```typescript
// Server side — route.ts
function uint8ArrayToRecord(uint8Array: Uint8Array): Record<number, number> {
  const out: Record<number, number> = {};
  for (let i = 0; i < uint8Array.length; i++) {
    out[i] = uint8Array[i]!;
  }
  return out;
}

// Client side — page.tsx
function uint8ArrayToBlob(uint8ArrayData: Record<number, number>): Blob {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));
  return new Blob([uint8Array], { type: "audio/mpeg" });
}
```

**The pipeline is:**

```
Uint8Array (raw audio bytes)
  → uint8ArrayToRecord()          // server: {0:73, 1:68, 2:51, ...}
  → JSON.stringify()              // SSE: {"0":73,"1":68,"2":51,...}
  → JSON.parse()                  // client: {"0":73,"1":68,"2":51,...}
  → uint8ArrayToBlob()            // Object.values() → Uint8Array → Blob
```

**`Object.values()` on `{"0":73, "1":68, ...}` returns values in _insertion order_,
which for integer-like keys (0, 1, 2...) V8/SpiderMonkey sort ascending.
BUT after `JSON.stringify` → `JSON.parse`, key order is preserved per JSON spec…
for string keys. Integer keys ("0", "1") are sorted by V8 regardless.**

**⚠️ The REAL problem**: `JSON.stringify` on a 100KB+ audio Record<number,number>
produces an enormous JSON payload. If it gets large enough (say >16MB),
it can cause the SSE event to be truncated or the JSON parse to fail silently
for the audio portion. The blob would then be incomplete → explains readyState 2
(has the MP3 header but not enough frame data to play).

### 🟡 Issue 3: `audioData` stored on segment is the raw Record, not the Blob

The segment stores `audioData: data.audioData` (the Record<number,number>) alongside
`audioUrl` (the blob URL). This is a huge object kept in React state. Not a bug per se,
but it's wasteful and could cause performance issues.

### 🟡 Issue 4: `networkState` is 1 (NETWORK_IDLE)

`networkState: 1` means the element has chosen a resource but is not actively using the
network — expected for a blob URL. This is fine. The issue is the element never transitions
past readyState 2.

---

## Recommended Investigation

### Quick test: verify the blob is playable

Add this to the `complete` event handler in `generateSegment`, right after creating the blob:

```typescript
// Debug: try playing the blob directly in a throwaway audio element
const testAudio = new Audio(url);
testAudio
  .play()
  .then(() => console.log("✅ Test audio plays fine"))
  .catch((e) => console.error("❌ Test audio failed:", e));
```

If this fails too → the blob itself is corrupt.
If this plays fine → the issue is how UnifiedPlayback receives / uses the URL.

### Quick test: compare blob size to original audio size

In the server route, log the audio byte length:

```typescript
logger.log("TTS Stream", `Audio byte length: ${audio.uint8Array.length}`);
```

On the client, you already log `blobSize`. If `blobSize !== audio byte length`, bytes
were lost in the Record→JSON→Record→Uint8Array roundtrip.

---

## File Reference

| File                                    | Role                                                 |
| --------------------------------------- | ---------------------------------------------------- |
| `app/speak/page.tsx`                    | Main page: state machine, generation logic, UI modes |
| `app/api/ai/tts/stream/route.ts`        | SSE endpoint: generates audio, sends as JSON Record  |
| `app/api/ai/tts/transform/route.ts`     | LLM text enhancement endpoint                        |
| `components/tts/UnifiedPlayback.tsx`    | Playback UI: `<audio>` element, skip, download       |
| `components/tts/SegmentManager.tsx`     | Segment list UI: generate/skip/preview per segment   |
| `components/tts/GenerationProgress.tsx` | Progress bar during generation                       |
| `components/tts/ClipBrowser.tsx`        | Saved clips browser (IndexedDB)                      |
| `lib/tts/token-calculator.ts`           | Cost/duration estimation, text splitting             |
| `lib/tts/clip-store.ts`                 | IndexedDB persistence for generated clips            |
