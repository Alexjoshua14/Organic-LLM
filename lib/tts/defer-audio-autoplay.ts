/**
 * iOS / iPadOS WebKit only allows `HTMLMediaElement.play()` when it still counts as user-initiated.
 * Our TTS pipeline calls `play()` after `await` (network / MSE), which loses the gesture chain.
 * When true, callers should set `autoplay: false` on TTS and let the user tap native play (or call `play()` from a fresh tap).
 */
export function shouldDeferAudioAutoplayToUserGesture(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;

  if (/iP(hone|od|ad)/.test(ua)) {
    return true;
  }

  // iPadOS 13+ often reports as Mac + touch
  if (/Macintosh/.test(ua) && "ontouchend" in document) {
    return true;
  }

  return false;
}
