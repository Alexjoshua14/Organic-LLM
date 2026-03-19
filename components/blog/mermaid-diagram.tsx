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

  const applyGlassStylingToSvg = (svgEl: SVGSVGElement) => {
    const styleId = "mermaid-glass-style";

    // Remove any prior injected style so re-renders don't accumulate.
    svgEl.querySelector(`#${styleId}`)?.remove();

    const styleEl = document.createElement("style");
    styleEl.setAttribute("id", styleId);
    styleEl.textContent = `
      /* Glass-like nodes (semi-transparent fill + subtle border) */
      .mermaid svg .node rect,
      .mermaid svg .node polygon,
      .mermaid svg .node circle,
      .mermaid svg .node ellipse,
      .mermaid svg .node path {
        fill: rgba(255, 255, 255, 0.045) !important;
        stroke: rgba(255, 255, 255, 0.12) !important;
        stroke-width: 1 !important;
      }

      /* Labels */
      .mermaid svg .label text,
      .mermaid svg .node text {
        fill: rgba(255, 255, 255, 0.85) !important;
      }

      /* Edges */
      .mermaid svg .edgePath path {
        stroke: rgba(255, 255, 255, 0.35) !important;
      }

      /* Dark mode tweaks (your app uses Tailwind's .dark class) */
      .dark .mermaid svg .label text,
      .dark .mermaid svg .node text {
        fill: rgba(255, 255, 255, 0.9) !important;
      }
    `;

    svgEl.prepend(styleEl);
  };

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
          applyGlassStylingToSvg(svg as SVGSVGElement);
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
