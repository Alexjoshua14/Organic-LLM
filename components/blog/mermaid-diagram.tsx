"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
});

export function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || !containerRef.current) return;
    setError(null);
    containerRef.current.textContent = code;
    mermaid
      .run({
        nodes: [containerRef.current],
        suppressErrors: false,
      })
      .then(() => {
        const svg = containerRef.current?.querySelector?.("svg");

        if (svg) {
          svg.setAttribute("role", "img");
          svg.setAttribute("aria-label", "Diagram");
        }
      })
      .catch((err) => {
        setError(err.message ?? "Failed to render diagram");
      });
  }, [code]);

  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        Diagram could not be rendered: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid my-4 flex justify-center overflow-x-auto [&_svg]:max-w-full"
    />
  );
}
