import { describe, expect, test } from "bun:test";

import {
  buildAionPresenceSystemPrompt,
  formatAionPresenceEvent,
  formatAionPresenceLedger,
  isAionPresenceSilentReply,
  AION_PRESENCE_SILENT_TOKEN,
} from "@/lib/system-prompt/aion-presence";
import type { AionEvent } from "@/lib/schemas/aion-presence";

const sampleEvent: AionEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "button",
  surface: "event-bench",
  label: "Burst click",
  at: Date.now(),
  payload: { count: 3 },
};

describe("aion presence prompt", () => {
  test("includes the silent contract and current event", () => {
    const prompt = buildAionPresenceSystemPrompt({ event: sampleEvent });

    expect(prompt).toContain(AION_PRESENCE_SILENT_TOKEN);
    expect(prompt).toContain("Burst click");
    expect(prompt).toContain("event-bench");
    expect(prompt).toContain('"count":3');
  });

  test("renders resumed context and ledger before the event", () => {
    const prompt = buildAionPresenceSystemPrompt({
      event: sampleEvent,
      resumed: true,
      sessionContext: "Conversation so far:\nWe talked about presence.",
      ledger: [{ kind: "ui.action", label: "opened card", at: Date.now() - 5_000 }],
    });

    const contextAt = prompt.indexOf("Conversation so far:");
    const ledgerAt = prompt.indexOf("Since your last reply the user:");
    const eventAt = prompt.indexOf("Current event:");

    expect(contextAt).toBeGreaterThanOrEqual(0);
    expect(ledgerAt).toBeGreaterThan(contextAt);
    expect(eventAt).toBeGreaterThan(ledgerAt);
  });

  test("format helpers stay compact", () => {
    expect(formatAionPresenceEvent(sampleEvent)).toContain("kind: button");
    expect(formatAionPresenceLedger([{ kind: "callback", label: "done", at: Date.now() }])).toContain(
      "done"
    );
  });

  test("silent reply detection", () => {
    expect(isAionPresenceSilentReply(AION_PRESENCE_SILENT_TOKEN)).toBe(true);
    expect(isAionPresenceSilentReply(`  ${AION_PRESENCE_SILENT_TOKEN}  `)).toBe(true);
    expect(isAionPresenceSilentReply("")).toBe(true);
    expect(isAionPresenceSilentReply(null)).toBe(true);
    expect(isAionPresenceSilentReply("Got it.")).toBe(false);
  });
});
