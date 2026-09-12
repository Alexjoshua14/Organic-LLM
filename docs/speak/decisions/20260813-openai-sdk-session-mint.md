# Mint Realtime sessions with the OpenAI Node SDK

**Status:** Accepted
**Date:** 2026-08-13
**Affects:** `app/api/ai/speak/realtime/session/route.ts`

## Context

Speak mints an ephemeral Realtime client secret server-side, then hands it to the browser, which
opens the actual audio connection over WebRTC. Two halves, two different runtimes:

| Half | Runs | Code |
|------|------|------|
| Session mint | Node (route handler) | `app/api/ai/speak/realtime/session/route.ts` |
| Audio transport | Browser | `hooks/use-realtime-voice.ts` |

The mint was a hand-rolled `fetch` to `https://api.openai.com/v1/realtime/client_secrets` with the
response cast to a locally-declared structural type:

```ts
const secretPayload = (await openaiRes.json()) as {
  value?: string;
  expires_at?: number;
  session?: { id?: string };
};
```

That cast asserts a shape rather than checking one. The session payload — nested `audio.input`,
`turn_detection`, transcription and voice config — got no type checking at all, so a typo in a
nested key surfaced as a 400 from OpenAI at runtime instead of an error at build time.

## Decision

Use the official `openai` Node SDK for the mint only:

```ts
const openai = new OpenAI({ apiKey });

const secretPayload = await openai.realtime.clientSecrets.create({
  expires_after: { anchor: "created_at", seconds: 600 },
  session: { type: "realtime", model, instructions, tools, /* … */ },
});
```

Same endpoint, same request body, same response contract. What changes is that the session
payload is checked against `RealtimeSessionCreateRequest` and the response arrives as
`ClientSecretCreateResponse` instead of a cast.

**The browser half is untouched.** `useRealtimeVoice` keeps its WebRTC peer connection and its SDP
exchange with `/v1/realtime/calls`. The Node SDK does not run that in the browser.

### Held constant

The route's JSON response — `clientSecret`, `sessionId`, `expiresAt`, `model`, `threadId`,
`modalities`, `budget` — is unchanged, so the hook needed no edit. Auth, rate limits,
`createChat()`, and the Redis session registration are unchanged. SDK failures map to the same
502 `"Failed to mint Realtime session"` the `!res.ok` branch returned.

`ClientSecretCreateResponse.session.id` is typed non-optional in both union arms, so the
`crypto.randomUUID()` fallback for `sessionId` is now belt-and-braces rather than load-bearing. It
stays: a session we cannot identify cannot be metered or ended.

## Alternatives rejected

**`@openai/agents` (`RealtimeAgent`).** Replaces the transport *and* claims ownership of tool
dispatch and conversation history. Speak's tools execute on our server
(`lib/speak/execute-speak-tool.ts`) and return a deliberately split result: `modelResult` goes
back as the `function_call_output`, while `clientEffects` is routed to the UI and never reaches
the model. `hooks/use-realtime-voice.ts` is what performs that split. Adopting the Agents SDK
would mean re-expressing it inside a framework built on the assumption that the model sees its
own tool results. Presentation rules for what a tool is allowed to say and show are in
[tool-behavior.md](../tool-behavior.md).

**Vercel AI SDK Realtime** (`experimental_useRealtime`). The repo is on `ai@5`; that API lands in
v6, and it is WebSocket-based regardless. Speak is on WebRTC for browser audio.

**Server-side WebSocket audio.** Moves the media path onto our infrastructure and adds a hop to
every audio frame. WebRTC to OpenAI direct is the reason latency is what it is.

## Consequences

- One new runtime dependency: `openai`.
- Nested session config is now type-checked; the `as` cast on the response is gone.
- Model IDs and transcription models that outpace the SDK's string unions still work — both are
  `(string & {})` unions, so a newer id needs no cast. Should a field ever narrow, cast that field
  rather than dropping it.
- The SDK throws on non-2xx instead of returning `res.ok === false`, so the mint is wrapped in
  `try`/`catch`. `OpenAI.APIError` carries `status` for the log line.

## See also

- [Speak README](../README.md) — code paths and current session behavior
- [Maintenance protocol](../../hub/maintenance-protocol.md) — how this decision got recorded
