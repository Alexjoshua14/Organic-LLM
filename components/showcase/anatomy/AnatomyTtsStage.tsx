"use client";

import type { TtsStage } from "@/lib/showcase/showcase-trace";

import { motion } from "framer-motion";

import { useAnatomyMotion } from "./anatomy-motion";

import { glass } from "@/components/design-system/primitives";
import { TTSDockLayout, ttsDockAudioSurfaceClass } from "@/components/tts/tts-dock-layout";
import { cn } from "@/lib/utils";

export function AnatomyTtsStage({ stage }: { stage: TtsStage }) {
  const { fadeIn } = useAnatomyMotion();
  const t = stage.artifact;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div {...(fadeIn ?? {})} transition={{ delay: 0.06 }}>
          <div className="mb-1 text-xs font-medium text-muted-foreground">Before preprocessing</div>
          <div
            className={cn(
              "max-h-48 overflow-auto rounded-xl border border-border/50 p-3 text-xs leading-snug text-muted-foreground",
              glass()
            )}
          >
            {t.speechFriendlyBefore}
          </div>
        </motion.div>
        <motion.div {...(fadeIn ?? {})} transition={{ delay: 0.12 }}>
          <div className="mb-1 text-xs font-medium text-muted-foreground">After preprocessing</div>
          <div
            className={cn(
              "max-h-48 overflow-auto rounded-xl border border-border/50 p-3 text-xs leading-snug text-foreground/95",
              glass()
            )}
          >
            {t.speechFriendlyAfter}
          </div>
        </motion.div>
      </div>

      <motion.div {...(fadeIn ?? {})} transition={{ delay: 0.18 }}>
        <div className="mb-2 text-xs font-medium text-muted-foreground">Recorded playback</div>
        <TTSDockLayout
          show
          variant="inline"
          audio={
            /* eslint-disable-next-line jsx-a11y/media-has-caption -- demo clip */
            <audio
              controls
              controlsList="nomute"
              preload="metadata"
              src={t.audioUrl}
              className={ttsDockAudioSurfaceClass(true)}
            />
          }
        />
      </motion.div>
    </div>
  );
}
