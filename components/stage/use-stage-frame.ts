"use client";

import { useEffect, useRef, useState } from "react";

export function useStageMeasurements() {
  const root = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  const wordmark = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1100, height: 620, composerHeight: 80 });

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      // The docked agent centers under the wordmark; the stylesheet reads its width from here.
      const mark = entries.find((entry) => entry.target === wordmark.current);

      if (mark)
        root.current?.style.setProperty("--stage-rail", `${Math.round(mark.contentRect.width)}px`);
      setSize((current) => {
        let next = current;

        for (const entry of entries) {
          if (entry.target === wordmark.current) continue;
          const { width, height } = entry.contentRect;
          const values =
            entry.target === root.current
              ? { width: Math.round(width), height: Math.round(height) }
              : { composerHeight: Math.ceil(height) };

          if (
            Object.entries(values).some(
              ([key, value]) => current[key as keyof typeof current] !== value
            )
          )
            next = { ...next, ...values };
        }

        return next;
      });
    });

    if (root.current) observer.observe(root.current);
    if (composer.current) observer.observe(composer.current);
    if (wordmark.current) observer.observe(wordmark.current);

    return () => observer.disconnect();
  }, []);

  return { root, composer, wordmark, size };
}
