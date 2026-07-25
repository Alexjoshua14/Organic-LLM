"use client";

import type { LiveVoicePhase } from "@/hooks/use-live-voice";

import { cn } from "@/lib/utils";

const PHASE_TO_PRESENCE: Record<LiveVoicePhase, "idle" | "active" | "thinking" | "responding"> = {
  idle: "idle",
  listening: "active",
  thinking: "thinking",
  speaking: "responding",
};

const PRESENCE_CONFIG = {
  idle: { opacity: 0.2, blur: 18, speed: "5s", scale: 0.85, color: "rgb(59, 130, 246)" },
  active: { opacity: 0.35, blur: 14, speed: "1.2s", scale: 1.0, color: "rgb(139, 92, 246)" },
  thinking: { opacity: 0.42, blur: 12, speed: "2s", scale: 1.05, color: "rgb(168, 85, 247)" },
  responding: { opacity: 0.55, blur: 8, speed: "1.5s", scale: 1.15, color: "rgb(217, 70, 239)" },
} as const;

export function VoicePresenceOrb({
  phase,
  size = 220,
  className,
}: {
  phase: LiveVoicePhase;
  size?: number;
  className?: string;
}) {
  const presence = PHASE_TO_PRESENCE[phase];
  const config = PRESENCE_CONFIG[presence];

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      style={{
        width: size,
        height: size,
        opacity: config.opacity,
        transform: `scale(${config.scale})`,
        transition: "all 1.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
    >
      <svg
        fill="none"
        height={size}
        style={{ filter: `blur(${config.blur}px)` }}
        viewBox="0 0 100 100"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M50,15 C70,15 85,30 85,50 C85,70 70,85 50,85 C30,85 15,70 15,50 C15,30 30,15 50,15 Z"
          fill={config.color}
          opacity="0.35"
        >
          <animate
            attributeName="d"
            dur={config.speed}
            repeatCount="indefinite"
            values="
              M50,15 C70,15 85,30 85,50 C85,70 70,85 50,85 C30,85 15,70 15,50 C15,30 30,15 50,15 Z;
              M50,18 C68,12 88,32 82,50 C88,68 68,88 50,82 C32,88 12,68 18,50 C12,32 32,12 50,18 Z;
              M50,15 C70,15 85,30 85,50 C85,70 70,85 50,85 C30,85 15,70 15,50 C15,30 30,15 50,15 Z
            "
          />
        </path>
        <circle cx="50" cy="50" fill={config.color} opacity="0.25" r="22">
          <animate attributeName="r" dur={config.speed} repeatCount="indefinite" values="20;26;20" />
        </circle>
      </svg>
    </div>
  );
}
