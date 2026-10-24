"use client";

import { useState, useEffect } from "react";

interface OrganicPresenceProps {
  show?: boolean;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size?: number;
  color?: string;
  intensity?: number; // 0-1, how visible/active it is
  className?: string;
}

/**
 * OrganicPresence - A lightweight, breathing SVG indicator that adds organic life to the UI.
 *
 * Features:
 * - Subtle pulsing animation (3s cycle)
 * - Organic blob shape that morphs
 * - Absolutely positioned, won't affect layout
 * - Fully client-rendered, lightweight
 * - Can be shown/hidden with smooth fade
 *
 * Usage:
 * <OrganicPresence show={isActive} position="bottom-right" />
 */
export function OrganicPresence({
  show = true,
  position = "bottom-right",
  size = 80,
  color = "currentColor",
  intensity = 0.3,
  className = "",
}: OrganicPresenceProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const positionStyles = {
    "top-left": { top: "2rem", left: "2rem" },
    "top-right": { top: "2rem", right: "2rem" },
    "bottom-left": { bottom: "2rem", left: "2rem" },
    "bottom-right": { bottom: "2rem", right: "2rem" },
  };

  return (
    <div
      className={`pointer-events-none ${className}`}
      style={{
        position: "fixed",
        ...positionStyles[position],
        width: size,
        height: size,
        opacity: show ? intensity : 0,
        transition: "opacity 2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        zIndex: 1,
      }}
    >
      <svg
        fill="none"
        height={size}
        style={{
          filter: "blur(12px)",
        }}
        viewBox="0 0 100 100"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer organic blob - slower pulse */}
        <path
          d="M50,20 C65,20 80,35 80,50 C80,65 65,80 50,80 C35,80 20,65 20,50 C20,35 35,20 50,20 Z"
          fill={color}
          opacity="0.15"
        >
          <animate
            attributeName="d"
            dur="4s"
            repeatCount="indefinite"
            values="
              M50,20 C65,20 80,35 80,50 C80,65 65,80 50,80 C35,80 20,65 20,50 C20,35 35,20 50,20 Z;
              M50,25 C63,22 78,38 78,50 C78,62 63,78 50,75 C37,78 22,62 22,50 C22,38 37,22 50,25 Z;
              M50,20 C65,20 80,35 80,50 C80,65 65,80 50,80 C35,80 20,65 20,50 C20,35 35,20 50,20 Z
            "
          />
        </path>

        {/* Middle blob - medium pulse */}
        <path
          d="M50,30 C62,30 70,38 70,50 C70,62 62,70 50,70 C38,70 30,62 30,50 C30,38 38,30 50,30 Z"
          fill={color}
          opacity="0.2"
        >
          <animate
            attributeName="d"
            dur="3s"
            repeatCount="indefinite"
            values="
              M50,30 C62,30 70,38 70,50 C70,62 62,70 50,70 C38,70 30,62 30,50 C30,38 38,30 50,30 Z;
              M50,32 C60,28 72,40 68,50 C72,60 60,72 50,68 C40,72 28,60 32,50 C28,40 40,28 50,32 Z;
              M50,30 C62,30 70,38 70,50 C70,62 62,70 50,70 C38,70 30,62 30,50 C30,38 38,30 50,30 Z
            "
          />
        </path>

        {/* Inner core - fastest pulse */}
        <circle cx="50" cy="50" fill={color} opacity="0.25" r="15">
          <animate attributeName="r" dur="2.5s" repeatCount="indefinite" values="15;18;15" />
          <animate
            attributeName="opacity"
            dur="2.5s"
            repeatCount="indefinite"
            values="0.25;0.35;0.25"
          />
        </circle>
      </svg>
    </div>
  );
}

/**
 * CompactOrganicPresence - A smaller, more subtle version
 */
export function CompactOrganicPresence({
  show = true,
  position = "bottom-right",
  color = "currentColor",
  className = "",
}: Omit<OrganicPresenceProps, "size" | "intensity">) {
  return (
    <OrganicPresence
      className={className}
      color={color}
      intensity={0.2}
      position={position}
      show={show}
      size={50}
    />
  );
}
