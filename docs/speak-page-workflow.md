# Speak Page - TTS Workflow & Organic Presence States

The Speak page now features a two-step workflow with organic presence indicators that reflect the system's state.

## Workflow Overview

```
Input → Transform → Preview → Generate → Ready → Play → Complete
  ↑                   ↓ (edit)                          ↓
  └───────────────────┴──────────────────────────────────┘
```

### States & Organic Presence

| Display Mode      | Presence State | Description                             |
| ----------------- | -------------- | --------------------------------------- |
| `input` (idle)    | `idle`         | Blue, slow - waiting for input          |
| `input` (focused) | `active`       | Purple, ready - user is typing          |
| `transforming`    | `thinking`     | Purple, morphing - processing text      |
| `preview`         | `active`       | Purple, steady - ready for decision     |
| `generating`      | `thinking`     | Purple, morphing - generating audio     |
| `ready`           | `active`       | Purple, steady - audio ready            |
| `playing`         | `responding`   | Fuchsia, shimmer - speaking             |
| `complete`        | `idle`         | Blue, slow - finished, waiting for next |

## Detailed State Descriptions

### 1. Input Mode

**What the user sees:**

- Editable textarea for input text
- Toggle for "Process Text for Speech"
- Model selector
- "Process & Preview" or "Preview" button

**Organic presence:**

- `idle` when textarea is not focused (blue, 5s pulse)
- `active` when typing (purple, 3.5s pulse)

### 2. Transforming Mode

**What happens:**

- Text sent to `/api/ai/tts/transform`
- LLM optimizes text for natural speech
- Shows shiny text animation

**Organic presence:**

- `thinking` (purple, 2.5s pulse, morphing)

### 3. Preview Mode

**What the user sees:**

- Original text (collapsed)
- **Editable** processed text
- Token/cost estimate for processed text
- "Regenerate" button to re-transform
- "Back to Edit" button
- "Generate Audio" button (the expensive call)

**Why this matters:**

- User can review LLM's transformation
- Edit specific parts that don't sound right
- Avoid expensive TTS calls on bad transformations
- Full control before committing to audio generation

**Organic presence:**

- `active` (purple, 3.5s pulse) - waiting for decision

### 4. Generating Mode

**What happens:**

- Processed text sent to TTS provider
- Audio file generated
- More expensive operation ($$$)

**Organic presence:**

- `thinking` (purple, 2.5s pulse, morphing)

### 5. Ready Mode

**What the user sees:**

- Text display with "Ready to play" indicator
- Play Audio button
- Start Over button
- Download button

**Organic presence:**

- `active` (purple, steady) - ready for action

### 6. Playing Mode

**What the user sees:**

- Shiny text animation synchronized with speech
- Purple border glow
- "Speaking..." indicator
- Pause button

**Organic presence:**

- `responding` (fuchsia, 2s pulse, shimmer) - actively speaking

### 7. Complete Mode

**What the user sees:**

- "Complete - Ready for next" indicator
- Green border glow
- Play Again button
- New Text button
- Download button

**Organic presence:**

- `idle` (blue, 5s pulse) - finished, calm, waiting

## API Endpoints

### Transform Text Only

```
POST /api/ai/tts/transform
Body: { text: string }
Response: {
  transformedText: string,
  originalLength: number,
  transformedLength: number,
  processingTimeMs: number
}
```

### Generate Audio

```
POST /api/ai/tts
Body: {
  text: string,
  model: string,
  skipTransform: boolean, // true when already transformed
  timestamps?: "word"
}
Response: {
  data: {
    uint8ArrayData: Record<number, number>,
    mediaType: string,
    format: "mp3" | "ogg" | "wav"
  }
}
```

## Cost Savings Flow

The preview step saves money by:

1. **Cheap transformation** (~$0.001) before expensive audio
2. **User review** catches bad transformations early
3. **Editing** allows fixing issues without re-generating
4. **Regenerate** only transforms text, not audio
5. **Only commit** to expensive TTS when satisfied

### Example Cost Comparison

**Without Preview (old flow):**

```
Input → Transform + Generate ($0.50) → Not happy → Repeat ($0.50)
Total: $1.00+ for one good result
```

**With Preview (new flow):**

```
Input → Transform ($0.001) → Preview → Edit → Transform ($0.001) → Happy → Generate ($0.50)
Total: $0.502 for one good result
```

## User Experience Design

### Visual Feedback

- Border colors indicate state (purple, emerald, amber)
- Shiny text animation shows activity
- Status badges with icons and text
- Smooth transitions between states

### Organic Presence

- Breathing animation reflects system state
- Color shifts with intensity of activity
- Never distracting, always informative
- Creates sense of "alive" interface

### Flow Design

- Clear progression through states
- Always able to go back
- Never trapped in a state
- Cost visible before expensive operations

## Integration with Adaptive Background

The Speak page also uses `AdaptiveLiquidChrome` which dims when:

- Hovering over textarea
- Hovering over model selector
- Hovering over action buttons
- Hovering over text display areas

Combined with `AdaptiveOrganicPresence`, this creates:

- Background responds to cursor position
- Presence responds to workflow state
- Two organic layers that compound together
- Revolutionary, alive interface feel
