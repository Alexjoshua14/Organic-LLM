/** Browser requirements checked before minting a Realtime session. */
export function assertVoiceCaptureSupported(): void {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    throw new Error(
      "Microphone access requires a secure connection. Open Organic LLM using its HTTPS address, then try Speak again."
    );
  }

  if (
    typeof navigator === "undefined" ||
    typeof navigator.mediaDevices?.getUserMedia !== "function"
  ) {
    throw new Error(
      "This browser cannot access the microphone. Open Organic LLM directly in Safari or Chrome, then try Speak again."
    );
  }

  if (typeof RTCPeerConnection !== "function") {
    throw new Error(
      "This browser does not support live voice. Open Organic LLM in an updated Safari or Chrome browser."
    );
  }
}

/** Native capture errors vary by browser; recovery should not depend on their wording. */
export function microphoneError(error: unknown): Error {
  const name = error && typeof error === "object" && "name" in error ? error.name : null;

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return new Error(
        "Microphone access is blocked. Allow microphone access for this site in your browser and device settings, then try again. If this page is embedded, open it directly in your browser."
      );
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new Error("No microphone was found. Connect or enable a microphone, then try again.");
    case "NotReadableError":
    case "TrackStartError":
      return new Error(
        "The microphone is unavailable. Close other apps using it, check your device settings, then try again."
      );
    case "AbortError":
      return new Error("Microphone access was interrupted. Try Speak again.");
    default:
      return error instanceof Error
        ? error
        : new Error("Could not access the microphone. Try again.");
  }
}
