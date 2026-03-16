"use client";

import { useState, useEffect } from "react";

type PresenceState = "idle" | "active" | "thinking" | "responding";

interface AdaptiveOrganicPresenceProps {
  state?: PresenceState;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  size?: number;
  className?: string;
}

/**
 * AdaptiveOrganicPresence - An intelligent, state-aware organic presence indicator.
 *
 * States:
 * - idle: Barely visible, slow breathing (resting)
 * - active: More visible, steady pulse (ready)
 * - thinking: Medium intensity, morphing (processing)
 * - responding: Full intensity, active movement (engaged)
 *
 * This component embodies the "alive" feeling - it breathes with the application state.
 */
export function AdaptiveOrganicPresence({
  state = "idle",
  position = "bottom-right",
  size = 100,
  className = "",
}: AdaptiveOrganicPresenceProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // State-based configuration
  const stateConfig = {
    idle: {
      opacity: 0.15,
      blur: 16,
      speed: "5s",
      scale: 0.8,
      color: "rgb(59, 130, 246)", // blue
    },
    active: {
      opacity: 0.25,
      blur: 14,
      speed: "1.5s",
      scale: 0.9,
      color: "rgb(139, 92, 246)", // purple
    },
    thinking: {
      opacity: 0.35,
      blur: 12,
      speed: "2.5s",
      scale: 1.0,
      color: "rgb(168, 85, 247)", // purple-500
    },
    responding: {
      opacity: 0.45,
      blur: 10,
      speed: "2s",
      scale: 1.1,
      color: "rgb(217, 70, 239)", // fuchsia-500
    },
  };

  const config = stateConfig[state];

  const positionStyles = {
    "top-left": { top: "2rem", left: "2rem" },
    "top-right": { top: "2rem", right: "2rem" },
    "bottom-left": { bottom: "2rem", left: "2rem" },
    "bottom-right": { bottom: "2rem", right: "2rem" },
    center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
  };

  return (
    <div
      className={`pointer-events-none ${className}`}
      style={{
        position: "fixed",
        ...positionStyles[position],
        width: size,
        height: size,
        opacity: config.opacity,
        transition: "all 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        zIndex: 1,
        transform: `scale(${config.scale})`,
      }}
    >
      <svg
        fill="none"
        height={size}
        style={{
          filter: `blur(${config.blur}px)`,
          transition: "filter 2s ease-out",
        }}
        viewBox="0 0 100 100"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer organic blob */}
        <path
          d="M50,15 C70,15 85,30 85,50 C85,70 70,85 50,85 C30,85 15,70 15,50 C15,30 30,15 50,15 Z"
          fill={config.color}
          opacity="0.3"
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

        {/* Middle layer */}
        <path
          d="M50,25 C65,25 75,35 75,50 C75,65 65,75 50,75 C35,75 25,65 25,50 C25,35 35,25 50,25 Z"
          fill={config.color}
          opacity="0.4"
        >
          <animate
            attributeName="d"
            dur={`${parseFloat(config.speed) * 0.8}s`}
            repeatCount="indefinite"
            values="
              M50,25 C65,25 75,35 75,50 C75,65 65,75 50,75 C35,75 25,65 25,50 C25,35 35,25 50,25 Z;
              M50,28 C63,23 77,37 72,50 C77,63 63,77 50,72 C37,77 23,63 28,50 C23,37 37,23 50,28 Z;
              M50,25 C65,25 75,35 75,50 C75,65 65,75 50,75 C35,75 25,65 25,50 C25,35 35,25 50,25 Z
            "
          />
        </path>

        {/* Inner core */}
        <circle cx="50" cy="50" fill={config.color} opacity="0.5" r="12">
          <animate
            attributeName="r"
            dur={`${parseFloat(config.speed) * 0.6}s`}
            repeatCount="indefinite"
            values="12;16;12"
          />
          <animate
            attributeName="opacity"
            dur={`${parseFloat(config.speed) * 0.6}s`}
            repeatCount="indefinite"
            values="0.5;0.7;0.5"
          />
        </circle>

        {/* Subtle shimmer for responding state */}
        {state === "responding" && (
          <circle cx="50" cy="50" fill="white" opacity="0" r="8">
            <animate attributeName="r" dur="1.5s" repeatCount="indefinite" values="8;20;8" />
            <animate attributeName="opacity" dur="1.5s" repeatCount="indefinite" values="0;0.3;0" />
          </circle>
        )}
      </svg>
    </div>
  );
}

/**
 * Hook to manage organic presence state based on user interaction
 */
export function useOrganicPresenceState() {
  const [state, setState] = useState<PresenceState>("idle");

  const setActive = () => setState("active");
  const setThinking = () => setState("thinking");
  const setResponding = () => setState("responding");
  const setIdle = () => setState("idle");

  return {
    state,
    setActive,
    setThinking,
    setResponding,
    setIdle,
  };
}
