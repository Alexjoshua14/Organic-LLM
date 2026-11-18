import { BlogFigure } from "./blog-figure";

import { cn } from "@/lib/utils";

type Layer = {
  title: string;
  owner: "ours" | "theirs";
  lines: readonly string[];
};

const BROWSER: Layer = {
  title: "Your browser",
  owner: "ours",
  lines: [
    "Voice session, kept alive across pages",
    "Transport seam",
    "Event classifier",
    "Live bar and stage",
  ],
};

const OPENAI: Layer = {
  title: "OpenAI Realtime API",
  owner: "theirs",
  lines: ["Hears you", "Takes turns", "Speaks"],
};

const SERVER: Layer = {
  title: "Organic LLM server",
  owner: "ours",
  lines: ["Mints the session", "Runs the tools", "Keeps threads, transcripts and memory"],
};

function Box({ layer }: { layer: Layer }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border p-inset-lg",
        layer.owner === "ours"
          ? "border-lumen-deep/40 bg-background/70"
          : "border-dashed border-border bg-secondary/30"
      )}
    >
      <div className="mb-stack-sm flex items-baseline justify-between gap-inline-sm">
        <h3 className="m-0! text-sm! font-medium! text-foreground">{layer.title}</h3>
        <span className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
          {layer.owner === "ours" ? "Ours" : "Theirs"}
        </span>
      </div>
      <ul className="m-0 list-none space-y-stack-xs p-0 text-xs text-muted-foreground">
        {layer.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

/** A labelled link between two boxes. Reads as a line, not a gap. */
function Connector({ children }: { children: string }) {
  return (
    <div className="flex items-center justify-center gap-inline-sm py-stack-sm text-xs text-muted-foreground @xl:py-0">
      <span aria-hidden className="h-4 w-px bg-border @xl:h-px @xl:w-4" />
      <span className="text-center">{children}</span>
      <span aria-hidden className="h-4 w-px bg-border @xl:h-px @xl:w-4" />
    </div>
  );
}

/**
 * Who owns which layer of a voice call, as a stacked diagram that holds at phone width (where a
 * generated flowchart would have to scroll). The browser leads; the model and the server sit
 * beneath it, each with one labelled link back. Dashed means someone else's.
 */
export function VoiceLayersFigure() {
  return (
    <BlogFigure caption="Solid borders are ours. The dashed box is OpenAI's.">
      <div className="space-y-stack-sm rounded-xl border border-border bg-secondary/40 p-inset-xl">
        <Box layer={BROWSER} />
        <div className="grid grid-cols-1 gap-stack-sm @xl:grid-cols-2 @xl:gap-inline-lg">
          <div className="space-y-stack-sm">
            <Connector>audio and events, directly over WebRTC</Connector>
            <Box layer={OPENAI} />
          </div>
          <div className="space-y-stack-sm">
            <Connector>session secret, tool calls, transcripts</Connector>
            <Box layer={SERVER} />
          </div>
        </div>
      </div>
    </BlogFigure>
  );
}
