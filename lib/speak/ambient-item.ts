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
 * 2. **It is not a user turn.** The model will not treat it as something addressed to it.
 *
 * ## The label carries identity; the instructions carry behaviour
 *
 * Every item opens with {@link AMBIENT_LABEL}. What the model should *do* with a `[Screen]` item —
 * trust the newest, use it for "this", never announce it — lives once in the session instructions
 * (`lib/system-prompt/speak-realtime.ts`). An earlier version put a paragraph of prohibitions in
 * every item instead ("do not respond… do not acknowledge…"), with nothing in the instructions
 * saying screen context existed at all; the model read that as "you cannot see the screen".
 *
 * ## One current item, not a pile
 *
 * Each item carries an id we choose, so the next push can delete it
 * ({@link buildAmbientDeleteEvent}). The model then holds exactly one description of the screen
 * rather than a history of pages it has to arbitrate between. Both events carry an `event_id` with
 * {@link AMBIENT_EVENT_PREFIX}, so an error they provoke — a delete racing `retention_ratio`
 * truncation, say — can be recognised and kept away from the user.
 *
 * Alternatives considered: `session.update` with new `instructions` rewrites the whole preamble on
 * every navigation and re-bills it each turn; an out-of-band `response.create` with
 * `conversation: "none"` produces output we would only discard.
 *
 * `session.thinking.append` is the purpose-built event for this, but only in **GPT-Live**
 * (`gpt-live-1`, `/v1/live`) — a separate API whose tools run through delegation. Speak runs
 * `gpt-realtime` over `/v1/realtime/calls`, where the event does not exist; the openai SDK types
 * it under `resources/live` only. Adopting it means migrating the session, not swapping this
 * builder — see the ambient presence ADR.
 */

/** Opens every screen item. The instructions refer to items by this label. */
export const AMBIENT_LABEL = "[Screen]";

/**
 * Sent when there is nothing to describe — a page with no registered surface, or one whose context
 * could not be built — so the item it replaces does not leave the model describing a page the user
 * already left.
 */
export const AMBIENT_CLEARED_BODY =
  "The user is on a page you have no context for. Anything you were told about their screen " +
  "before is out of date.";

/** Marks `event_id`s on ambient events so errors they cause can be told apart. */
export const AMBIENT_EVENT_PREFIX = "ambient_";

export type RealtimeClientEvent = Record<string, unknown>;

/** True for errors caused by an ambient create or delete, which must never reach the user. */
export function isAmbientClientEvent(eventId: string | null | undefined): boolean {
  return typeof eventId === "string" && eventId.startsWith(AMBIENT_EVENT_PREFIX);
}

/**
 * Builds the `conversation.item.create` event. Returns `null` for empty bodies so callers can
 * skip the send rather than push a no-op item into history.
 *
 * `itemId` is ours so the next push can delete this one. The API accepts client ids; keep them
 * short (the hook's are ~16 characters).
 */
export function buildAmbientContextItem(
  body: string,
  ids?: { itemId: string; eventId: string }
): RealtimeClientEvent | null {
  const trimmed = body.trim();

  if (!trimmed) return null;

  return {
    type: "conversation.item.create",
    ...(ids ? { event_id: ids.eventId } : {}),
    item: {
      ...(ids ? { id: ids.itemId } : {}),
      type: "message",
      role: "system",
      content: [{ type: "input_text", text: `${AMBIENT_LABEL}\n${trimmed}` }],
    },
  };
}

/** Removes a previous screen item, so only the current one stays in the conversation. */
export function buildAmbientDeleteEvent(itemId: string, eventId: string): RealtimeClientEvent {
  return { type: "conversation.item.delete", item_id: itemId, event_id: eventId };
}
