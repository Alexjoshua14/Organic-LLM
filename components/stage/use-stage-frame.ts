"use client";

import { useEffect, useRef, useState } from "react";

export function useStageMeasurements() {
  const root = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1100, height: 620, composerHeight: 80 });

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setSize((current) => {
        let next = current;

        for (const entry of entries) {
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

    return () => observer.disconnect();
  }, []);

  return { root, composer, size };
}
