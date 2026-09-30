"use client";

import { useArcadiaMultitask } from "./multitask-provider";

import { glass } from "@/components/design-system/primitives";
import { ARCADIA_ROLE_VOICE_PRESETS } from "@/lib/arcadia/multitask/voice-assignment";
import { SPEAK_REALTIME_VOICES } from "@/lib/schemas/speak-realtime-voice";
import { cn } from "@/lib/utils";

/**
 * Documents role → Realtime voice id assignment next to the shell so it is not a magic list.
 */
export function VoiceRosterLegend({ className }: { className?: string }) {
  const { agents } = useArcadiaMultitask();

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "rounded-lg border border-border/50 px-3 py-2 text-[11px] leading-relaxed",
        className
      )}
    >
      <p className="font-medium text-foreground">Voice roster</p>
      <p className="mt-1 text-muted-foreground">
        Each subagent uses a distinct OpenAI Realtime voice id from the Speak stack (
        {SPEAK_REALTIME_VOICES.join(", ")}). Concurrent agents avoid sharing a voice while
        alternatives remain.
      </p>
      <ul className="mt-2 space-y-0.5 text-muted-foreground">
        {agents.map((a) => (
          <li key={a.id}>
            <span className="text-foreground">{a.name}</span> ({a.role}) →{" "}
            <span className="font-mono text-foreground">{a.voiceId}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-muted-foreground">
        Role presets:{" "}
        {Object.entries(ARCADIA_ROLE_VOICE_PRESETS)
          .map(([role, voice]) => `${role}=${voice}`)
          .join(" · ")}
      </p>
    </div>
  );
}
