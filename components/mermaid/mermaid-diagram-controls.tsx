"use client";

import { Copy, Download, Maximize2 } from "lucide-react";

import { mermaidControlButtonClass, mermaidControlsClass } from "@/lib/mermaid/presentation";

type MermaidDiagramControlsProps = {
  onExpand: () => void;
  onCopySource: () => void;
  onDownloadSvg: () => void;
};

export function MermaidDiagramControls({
  onExpand,
  onCopySource,
  onDownloadSvg,
}: MermaidDiagramControlsProps) {
  return (
    <div className={mermaidControlsClass}>
      <button
        aria-label="Expand diagram"
        className={mermaidControlButtonClass}
        type="button"
        onClick={onExpand}
      >
        <Maximize2 className="size-3.5" />
      </button>
      <button
        aria-label="Copy Mermaid source"
        className={mermaidControlButtonClass}
        type="button"
        onClick={onCopySource}
      >
        <Copy className="size-3.5" />
      </button>
      <button
        aria-label="Download SVG"
        className={mermaidControlButtonClass}
        type="button"
        onClick={onDownloadSvg}
      >
        <Download className="size-3.5" />
      </button>
    </div>
  );
}
