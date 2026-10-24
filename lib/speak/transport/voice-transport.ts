/**
 * Voice transport seam.
 *
 * `useRealtimeVoice` owns session lifecycle — minting, heartbeats, transcript flushing, tool
 * dispatch. It must not also own *how* bytes reach the model. That distinction is the whole
 * point of this file: today the browser holds the peer connection directly
 * ({@link createWebRtcVoiceTransport}), and a server-side relay can be dropped in later as a
 * second implementation without the hook, the provider, or any UI changing shape.
 *
 * See `docs/speak/decisions/` for the continuity ADR that gated this split.
 */

export type VoiceTransportKind = "webrtc" | "relay";

export type VoiceTransportEvents = {
  /** Raw JSON string from the model's event channel; the hook classifies it. */
  onServerEvent: (raw: string) => void;
  /** Fired once the downstream audio track arrives. */
  onRemoteStream: (stream: MediaStream) => void;
  /** Transport-initiated close (ICE failure, relay drop). Never fired by `close()`. */
  onClosed: (reason: string) => void;
};

export type VoiceTransportConnectArgs = {
  /** Ephemeral secret from `/api/ai/speak/realtime/session`. */
  clientSecret: string;
};

export interface VoiceTransport {
  readonly kind: VoiceTransportKind;
  /** Microphone capture. Available after `connect` resolves; the analyser taps it. */
  readonly localStream: MediaStream | null;
  /** Model audio. Available after `onRemoteStream`; the analyser taps it. */
  readonly remoteStream: MediaStream | null;
  connect(args: VoiceTransportConnectArgs, events: VoiceTransportEvents): Promise<void>;
  /** Client event up to the model. Returns `false` when the channel is not open. */
  send(event: Record<string, unknown>): boolean;
  close(): void;
}

export type VoiceTransportFactory = () => VoiceTransport;

/** The model's side refused the call. `status` is the HTTP status of the SDP exchange. */
export class RealtimeConnectError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Realtime connect failed (${status}): ${detail}`);
    this.name = "RealtimeConnectError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Whether a fresh mint is worth trying. A 5xx from `/realtime/calls` can follow a mint that
 * succeeded; a 4xx means the secret or offer itself is wrong, and a new secret for the same
 * config would fail the same way.
 */
export function isRetryableConnectError(error: unknown): error is RealtimeConnectError {
  return error instanceof RealtimeConnectError && error.status >= 500;
}

/** OpenAI's SDP exchange endpoint. The ephemeral secret authorizes the browser directly. */
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/**
 * Browser-held peer connection: the mic track goes straight to OpenAI and the model's audio
 * comes straight back. Lowest possible latency and no media egress of our own — at the cost
 * of dying with the document, which is why the provider resumes rather than relays.
 */
export function createWebRtcVoiceTransport(): VoiceTransport {
  let pc: RTCPeerConnection | null = null;
  let dc: RTCDataChannel | null = null;
  let local: MediaStream | null = null;
  let remote: MediaStream | null = null;
  let closedByUs = false;

  return {
    kind: "webrtc",

    get localStream() {
      return local;
    },

    get remoteStream() {
      return remote;
    },

    async connect({ clientSecret }, events) {
      closedByUs = false;
      pc = new RTCPeerConnection();

      pc.ontrack = (e) => {
        remote = e.streams[0] ?? null;
        if (remote) events.onRemoteStream(remote);
      };

      pc.onconnectionstatechange = () => {
        if (closedByUs || !pc) return;
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          events.onClosed(`Connection ${pc.connectionState}`);
        }
      };

      local = await navigator.mediaDevices.getUserMedia({ audio: true });
      pc.addTrack(local.getTracks()[0]!);

      dc = pc.createDataChannel("oai-events");
      dc.addEventListener("message", (ev) => {
        if (typeof ev.data === "string") events.onServerEvent(ev.data);
      });

      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpRes.ok) {
        const errText = await sdpRes.text().catch(() => "");

        throw new RealtimeConnectError(sdpRes.status, errText);
      }

      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
    },

    send(event) {
      if (!dc || dc.readyState !== "open") return false;

      dc.send(JSON.stringify(event));

      return true;
    },

    close() {
      closedByUs = true;

      try {
        dc?.close();
      } catch {
        /* already gone */
      }
      dc = null;

      try {
        pc?.close();
      } catch {
        /* already gone */
      }
      pc = null;

      local?.getTracks().forEach((t) => t.stop());
      local = null;
      remote = null;
    },
  };
}
