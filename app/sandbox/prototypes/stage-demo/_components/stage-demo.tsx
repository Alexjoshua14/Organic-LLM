"use client";

import { StageView } from "@/components/stage/stage";
import { useStageDemo } from "@/components/stage/use-stage-demo";
import { STAGE_DEMO_SCENES } from "@/lib/stage/demo/scenes";

export function StageDemo() {
  const stage = useStageDemo();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav
        aria-label="Demo scenes"
        className="flex shrink-0 flex-wrap gap-2 border-b border-border/50 px-5 py-2 text-sm"
      >
        {STAGE_DEMO_SCENES.map((scene) => (
          <button
            key={scene.id}
            aria-pressed={stage.scene === scene.id}
            className="rounded-full border border-border/60 px-3 py-1 text-muted-foreground transition-colors hover:text-foreground aria-pressed:text-foreground"
            type="button"
            onClick={() => stage.show(scene.id)}
          >
            {scene.label}
          </button>
        ))}
      </nav>
      <div className="relative min-h-0 flex-1">
        <StageView scripted stage={stage} />
      </div>
    </div>
  );
}
