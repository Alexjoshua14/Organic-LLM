"use client";

import Link from "next/link";

import { StageView } from "@/components/stage/stage";
import { useStageDemo } from "@/components/stage/use-stage-demo";
import { triggerInsetX } from "@/lib/layout/nav-chrome";
import { STAGE_DEMO_SCENES } from "@/lib/stage/demo/scenes";
import { cn } from "@/lib/utils";

export function StageDemo() {
  const stage = useStageDemo();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* The scenes ride in the band Stage already keeps clear for the app's own chrome, between
          the sidebar toggle and the control cluster (9.5rem at md and up, as on Speak), so the
          demo's Stage has the real Stage's geometry. */}
      <nav
        aria-label="Demo scenes"
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex h-16 items-center gap-2 overflow-x-auto whitespace-nowrap text-sm [scrollbar-width:none]",
          triggerInsetX,
          "pr-24 md:pr-40"
        )}
      >
        <Link
          className="shrink-0 pr-2 text-muted-foreground transition-colors hover:text-foreground"
          href="/sandbox/prototypes"
        >
          &larr; Prototypes
        </Link>
        {STAGE_DEMO_SCENES.map((scene) => (
          <button
            key={scene.id}
            aria-pressed={stage.scene === scene.id}
            className="shrink-0 rounded-full border border-border/60 px-3 py-1 text-muted-foreground transition-colors hover:text-foreground aria-pressed:text-foreground"
            type="button"
            onClick={() => stage.show(scene.id)}
          >
            {scene.label}
          </button>
        ))}
      </nav>
      <StageView scripted stage={stage} />
    </div>
  );
}
