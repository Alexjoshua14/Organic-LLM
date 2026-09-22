/**
 * Silent context injection for a live Realtime session.
 *
 * ## Why a system message and not something else
 *
 * There is no dedicated "here is some context" event in the Realtime API. The documented path is
 * a `conversation.item.create` carrying a **system** message, sent *without* a following
 * `response.create`. OpenAI's own type docs for `RealtimeConversationItemSystemMessage` state the
 * intent exactly:
 *
 * > A system message in a Realtime conversation can be used to provide additional context or
 * > instructions to the model. This is similar but distinct from the instruction prompt provided
 * > at the start of a conversation, as system messages can be added at any point in the
 * > conversation. For major changes to the conversation's behavior, use instructions, but for
 * > smaller updates (e.g. "the user is now asking about a different topic"), use system messages.
 *
 * Two properties make this safe to fire on every navigation:
 *
 * 1. **It cannot trigger a reply.** Server VAD only opens a response off a committed *audio*
 *    buffer. A system item lands in history and waits.
 * 2. **It is not a user turn.** The model will not treat it as something addressed to it, so it
 *    will not answer, acknowledge, or narrate the navigation.
 *
 * Property 2 is structural but not absolute — a chatty model can still volunteer "I see you've
 * opened…". {@link AMBIENT_PREFACE} closes that off in the text itself.
 *
 * Alternatives considered: `session.update` with new `instructions` rewrites the whole preamble on
 * every navigation and re-bills it each turn; an out-of-band `response.create` with
 * `conversation: "none"` produces output we would only discard.
 */

/**
 * Prepended to every ambient push. Short on purpose — it is re-sent on each navigation and the
 * model re-reads the whole conversation every turn.
 */
export const AMBIENT_PREFACE =
  "[ambient screen context — not a request] The user just moved to a different part of the app. " +
  "This is background awareness only: do not respond to it, do not acknowledge it, and do not " +
  "change what you are doing. Use it only if the user later refers to what they are looking at.";

/** Sent when the user navigates somewhere with nothing registered, so stale context is not reused. */
export const AMBIENT_CLEARED_BODY =
  "The user is no longer looking at any surface you have context for. Treat previously described " +
  "screen content as stale.";

export type RealtimeClientEvent = Record<string, unknown>;

/**
 * Builds the `conversation.item.create` event. Returns `null` for empty bodies so callers can
 * skip the send rather than push a no-op item into history.
 */
export function buildAmbientContextItem(body: string): RealtimeClientEvent | null {
  const trimmed = body.trim();

  if (!trimmed) return null;

  return {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [{ type: "input_text", text: `${AMBIENT_PREFACE}\n\n${trimmed}` }],
    },
  };
}
