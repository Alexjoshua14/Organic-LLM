# Test Fixtures

Real API response data captured from ElevenLabs / Vercel AI SDK for use in the test suite.

## How to capture

1. Set the environment variable `LOG_TTS_FIXTURE=1` before running the dev server:

   ```bash
   LOG_TTS_FIXTURE=1 bun run dev
   ```

2. Trigger TTS generation:

   - **Streaming (ElevenLabs NDJSON)**: Use the `/speak/v2` page or any component that calls `/api/ai/tts-v2`
   - **SSE (Vercel AI SDK)**: Use the `/speak` page which calls `/api/ai/tts/stream`

3. Check the server logs for the fixture output between the `--- START ---` and `--- END ---` markers.

4. Copy the JSON and save it here:

   - `elevenlabs-stream-response.json` — from `/api/ai/tts-v2` (NDJSON chunks with alignment)
   - `generate-speech-response.json` — from `/api/ai/tts/stream` (single audio blob as base64)

5. Unset `LOG_TTS_FIXTURE` when done (the log is gated so it only fires when set to "1").

## File format

### `elevenlabs-stream-response.json`

```json
{
  "_meta": { "text": "...", "model": "...", "voiceId": "...", "chunkCount": 5 },
  "chunks": [
    { "audioBase64": "...", "alignment": { ... }, "normalizedAlignment": { ... } },
    ...
  ]
}
```

### `generate-speech-response.json`

```json
{
  "_meta": {
    "text": "...",
    "model": "...",
    "provider": "...",
    "byteLength": 12345
  },
  "audioBase64": "...",
  "format": "mp3",
  "mimeType": "audio/mpeg"
}
```
