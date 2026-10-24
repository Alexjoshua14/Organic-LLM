import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";

import { installVoiceBrowser } from "../helpers/voice-browser";

import { useRealtimeVoice } from "@/hooks/use-realtime-voice";
import { createWebRtcVoiceTransport } from "@/lib/speak/transport/voice-transport";

const events = {
  onServerEvent() {},
  onRemoteStream() {},
  onClosed() {},
};

let browser: ReturnType<typeof installVoiceBrowser>;

beforeEach(() => {
  browser = installVoiceBrowser();
});

afterEach(() => {
  cleanup();
  browser.restore();
});

describe("voice microphone preparation", () => {
  test("HTTP fails with an HTTPS recovery message before creating any connection", async () => {
    browser.replace(window, "isSecureContext", false);
    browser.replace(navigator, "mediaDevices", undefined);

    await expect(
      createWebRtcVoiceTransport().connect({ clientSecret: "unused" }, events)
    ).rejects.toThrow("HTTPS address");
    expect(browser.peers).toHaveLength(0);
    expect(browser.fetchMock).not.toHaveBeenCalled();
  });

  test("secure embedded browsers without capture get a browser recovery message", async () => {
    browser.replace(navigator, "mediaDevices", undefined);

    await expect(createWebRtcVoiceTransport().prepare!()).rejects.toThrow(
      "directly in Safari or Chrome"
    );
    expect(browser.getUserMedia).not.toHaveBeenCalled();
  });

  test("a mediaDevices object without getUserMedia is unsupported", async () => {
    browser.replace(navigator, "mediaDevices", {});

    await expect(createWebRtcVoiceTransport().prepare!()).rejects.toThrow(
      "cannot access the microphone"
    );
  });

  test("a browser without WebRTC fails before requesting the microphone", async () => {
    browser.replace(globalThis, "RTCPeerConnection", undefined);

    await expect(createWebRtcVoiceTransport().prepare!()).rejects.toThrow(
      "does not support live voice"
    );
    expect(browser.getUserMedia).not.toHaveBeenCalled();
  });

  test.each([
    ["NotAllowedError", "Allow microphone access"],
    ["SecurityError", "Allow microphone access"],
    ["NotFoundError", "No microphone was found"],
    ["NotReadableError", "Close other apps"],
    ["AbortError", "interrupted"],
  ])("%s provides a recovery message", async (name, message) => {
    browser.getUserMedia.mockRejectedValue(new DOMException("browser-specific wording", name));

    await expect(createWebRtcVoiceTransport().prepare!()).rejects.toThrow(message);
    expect(browser.peers).toHaveLength(0);
  });

  test("a successful call reuses the prepared microphone and releases it on close", async () => {
    const transport = createWebRtcVoiceTransport();

    await transport.prepare!();
    await transport.connect({ clientSecret: "test-secret" }, events);

    expect(browser.getUserMedia).toHaveBeenCalledTimes(1);
    expect(browser.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(browser.peers[0]!.addTrack).toHaveBeenCalledWith(browser.track);
    expect(transport.localStream).toBe(browser.stream);
    transport.close();
    expect(browser.stop).toHaveBeenCalledTimes(1);
    expect(transport.localStream).toBeNull();
    expect(browser.peers[0]!.close).toHaveBeenCalledTimes(1);
  });

  test("closing while the permission prompt is open stops a late microphone stream", async () => {
    let grant!: (stream: MediaStream) => void;

    browser.getUserMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          grant = resolve;
        })
    );
    const transport = createWebRtcVoiceTransport();
    const preparing = transport.prepare!();

    transport.close();
    grant(browser.stream);
    await expect(preparing).rejects.toThrow("cancelled");
    expect(browser.stop).toHaveBeenCalledTimes(1);
    expect(transport.localStream).toBeNull();
  });

  test("a closed transport cannot reopen its microphone during a late connect", async () => {
    const transport = createWebRtcVoiceTransport();

    await transport.prepare!();
    transport.close();
    await expect(transport.connect({ clientSecret: "unused" }, events)).rejects.toThrow(
      "cancelled"
    );
    expect(browser.getUserMedia).toHaveBeenCalledTimes(1);
    expect(browser.peers).toHaveLength(0);
  });
});

describe("voice session preparation", () => {
  test("an insecure page never mints a server session", async () => {
    browser.replace(window, "isSecureContext", false);
    browser.replace(navigator, "mediaDevices", undefined);
    const { result } = renderHook(() => useRealtimeVoice());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toContain("HTTPS address");
    expect(result.current.connecting).toBe(false);
    expect(result.current.connected).toBe(false);
    expect(browser.fetchMock).not.toHaveBeenCalled();
  });

  test("denying microphone permission never mints or retries a server session", async () => {
    browser.getUserMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    const { result } = renderHook(() => useRealtimeVoice());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toContain("Allow microphone access");
    expect(browser.fetchMock).not.toHaveBeenCalled();
    expect(browser.getUserMedia).toHaveBeenCalledTimes(1);
  });

  test("a failed mint releases the microphone that was already approved", async () => {
    browser.fetchMock.mockResolvedValue(
      Response.json({ error: "Budget reached" }, { status: 429 })
    );
    const { result } = renderHook(() => useRealtimeVoice());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toBe("Budget reached");
    expect(browser.stop).toHaveBeenCalledTimes(1);
    expect(browser.peers).toHaveLength(0);
    expect(result.current.localStream).toBeNull();
  });

  test("ending while minting releases the late session without reopening the microphone", async () => {
    let finishMint!: (response: Response) => void;
    let mintStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      mintStarted = resolve;
    });

    browser.fetchMock.mockImplementationOnce(() => {
      mintStarted();

      return new Promise((resolve) => {
        finishMint = resolve;
      });
    });
    const { result } = renderHook(() => useRealtimeVoice());

    await act(async () => {
      const connecting = result.current.connect();

      await started;
      await result.current.disconnect();
      finishMint(Response.json({ sessionId: "cancelled-session", clientSecret: "unused" }));
      await connecting;
    });

    expect(browser.getUserMedia).toHaveBeenCalledTimes(1);
    expect(browser.stop).toHaveBeenCalledTimes(1);
    expect(browser.peers).toHaveLength(0);
    expect(browser.fetchMock).toHaveBeenCalledTimes(2);
    expect(browser.fetchMock.mock.calls[1]?.[0]).toBe("/api/ai/speak/realtime/end");
    expect(JSON.parse(browser.fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      sessionId: "cancelled-session",
    });
    expect(result.current.sessionId).toBeNull();
    expect(result.current.connected).toBe(false);
  });
});
