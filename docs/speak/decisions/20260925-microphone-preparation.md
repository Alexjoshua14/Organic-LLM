# Prepare the microphone before minting a voice session

Date: 2026-09-25

## Context

The WebRTC transport previously accessed `navigator.mediaDevices.getUserMedia` after minting
a server session, without checking that the API existed. Mobile browsers can omit
`mediaDevices` on insecure pages, producing an undefined-property exception. Browser capture
requires a [secure context](https://www.w3.org/TR/mediacapture-streams/#dom-navigator-mediadevices).
[WebKit documents the HTTPS requirement](https://webkit.org/blog/7763/a-closer-look-into-webrtc/).

## Decision

The transport offers an optional `prepare()` step. The WebRTC implementation checks the
browser's secure-context status, microphone API, and peer-connection API, then requests the
microphone before `/realtime/session` is called. Other transports can retain their own
preparation behavior. `connect()` reuses the captured stream and still checks prerequisites
when used on its own.

Capture failures return actionable messages for insecure origins, unsupported browsers,
blocked permission, missing devices, and unavailable microphones. They never use the SDP
retry path. A failed session mint releases the microphone, and closing during an open
permission prompt stops any stream that arrives afterward. If a mint finishes after the
user ends the attempt, the hook closes that late session without reconnecting the microphone.

This changes error handling and session ordering. It cannot enable microphone capture on an
HTTP deployment; the serving origin needs HTTPS.

## Deployment verification

1. Check the exact URL opened on the phone, including scheme and port. Use a hostname with a
   certificate trusted by the phone and an HTTPS ingress that proxies to the app's existing
   port. LAN HTTP, `.local` HTTP, and a VPN's HTTP hostname do not satisfy secure-context rules.
2. Open `/speak` directly in a current Safari or Chrome browser. In a remote browser inspector,
   `window.isSecureContext` must be `true`,
   `typeof navigator.mediaDevices?.getUserMedia` must be `"function"`, and
   `typeof RTCPeerConnection` must be `"function"`.
3. If HTTPS is already in use but capture is absent, check embedded-browser restrictions. If
   capture exists but permission is blocked, check browser and OS microphone permissions and
   the response's `Permissions-Policy`. Embedded pages also need microphone delegation from
   their parent; opening the app directly avoids that dependency.
4. Verify sign-in and session cookies work on the chosen HTTPS origin. Start Speak, allow the
   microphone, confirm two-way audio, then end the call and confirm capture stops. Denying
   permission should show the recovery message with no `/realtime/session` request.

For an existing Tailscale deployment, [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
can provide a trusted HTTPS ingress within the tailnet. Check existing Serve mappings before
configuring a listener so another service is not replaced. The phone must use the resulting
HTTPS hostname and be connected to the tailnet. Do not use an insecure-origin browser bypass
as a deployment fix.

## Validation

`tests/unit/voice-microphone.test.ts` covers absent capture APIs, HTTP, absent WebRTC, native
permission/device errors, stream reuse, teardown, late permission resolution, and the absence
of session requests when capture cannot start. It also covers cancellation during minting.
Physical-device audio and deployment TLS
remain deployment checks; browser mocks do not establish them.
