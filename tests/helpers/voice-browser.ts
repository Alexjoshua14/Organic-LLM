import { mock } from "bun:test";

/** Capture and SDP fixtures; no microphone, network, or paid session is used. */
export function installVoiceBrowser() {
  const restorers: Array<() => void> = [];

  function replace(target: object, key: string, value: unknown) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);

    Object.defineProperty(target, key, { configurable: true, writable: true, value });
    restorers.push(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    });
  }

  const stop = mock(() => {});
  const track = { stop } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  const getUserMedia = mock(async (_constraints: MediaStreamConstraints) => stream);
  const peers: FakePeerConnection[] = [];

  class FakePeerConnection {
    addTrack = mock((_track: MediaStreamTrack) => {});
    close = mock(() => {});
    createDataChannel = () => ({ addEventListener() {}, close() {} });
    createOffer = async () => ({ type: "offer", sdp: "offer-sdp" });
    setLocalDescription = async () => {};
    setRemoteDescription = async () => {};

    constructor() {
      peers.push(this);
    }
  }

  const fetchMock = mock(
    async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("answer-sdp")
  );

  replace(window, "isSecureContext", true);
  replace(navigator, "mediaDevices", { getUserMedia });
  replace(globalThis, "RTCPeerConnection", FakePeerConnection);
  replace(globalThis, "fetch", fetchMock);

  return {
    replace,
    stream,
    track,
    stop,
    getUserMedia,
    peers,
    fetchMock,
    restore: () => restorers.reverse().forEach((restore) => restore()),
  };
}
