# Test Fixtures

Real API response data captured from ElevenLabs / Vercel AI SDK for use in the test suite.

## How to capture

1. Set the environment variable `LOG_TTS_FIXTURE=1` before running the dev server:

   ```bash
   LOG_TTS_FIXTURE=1 bun run dev
   ```

2. Trigger streaming TTS generation using Read Aloud mode on `/speak`, the `/speak/v2`
   demo, or another component that calls `/api/ai/tts-v2` (ElevenLabs NDJSON).
   The default Live mode on `/speak` uses OpenAI Realtime and does not produce TTS fixtures.

3. Check the server logs for the fixture output between the `--- START ---` and `--- END ---` markers.

4. Copy the JSON into `elevenlabs-stream-response.json` (NDJSON chunks with alignment).

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

Historical fixture captured from the retired `/api/ai/tts/stream` endpoint. Kept for
audio-byte and decoding tests; the capture instructions above produce the ElevenLabs
streaming fixture, not this format.

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
