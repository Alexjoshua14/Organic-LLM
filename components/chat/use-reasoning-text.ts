import { useEffect, useRef, useState } from "react";

const REASONING_FRAME_MS = 24;
const REASONING_CATCHUP_MS = 96;

/** Smooth bursts without delaying completed, replaced, hidden, or reduced-motion text. */
export function useReasoningText(text: string, animate: boolean) {
  const [visible, setVisible] = useState(text);
  const shown = useRef(text);
  const target = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    target.current = text;
    if (!animate || !text.startsWith(shown.current)) {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      shown.current = text;
      setVisible(text);

      return;
    }
    if (timer.current !== null || shown.current === text) return;
    const startedAt = Date.now();
    const start = shown.current.length;

    const tick = () => {
      const value = target.current;
      const progress = Math.min(1, (Date.now() - startedAt) / REASONING_CATCHUP_MS);
      let end = start + Math.ceil((value.length - start) * progress);

      if (progress < 1) {
        const boundary = value.slice(shown.current.length, end).search(/\s+\S*$/);

        if (boundary >= 0) end = shown.current.length + boundary + 1;
        // Do not expose half of a UTF-16 surrogate pair while catching up.
        if (/[\uD800-\uDBFF]/.test(value.charAt(end - 1))) end -= 1;
      }
      shown.current = value.slice(0, end);
      setVisible(shown.current);
      timer.current = end < value.length ? setTimeout(tick, REASONING_FRAME_MS) : null;
    };

    timer.current = setTimeout(tick, REASONING_FRAME_MS);
  }, [text, animate]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    []
  );

  return !animate || !text.startsWith(visible) ? text : visible;
}
