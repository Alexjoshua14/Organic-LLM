"use client";

import { useEffect } from "react";

export function RabbitHoleAmbientLayer() {
  useEffect(() => {
    // Add keyframe animations via style tag if not already present
    if (typeof document !== "undefined" && !document.getElementById("rabbit-hole-ambient-styles")) {
      const style = document.createElement("style");
      style.id = "rabbit-hole-ambient-styles";
      style.textContent = `
        @keyframes rabbit-hole-ambient-shift {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 0.3;
          }
          50% {
            transform: translate(-2%, 2%) scale(1.05);
            opacity: 0.25;
          }
          100% {
            transform: translate(2%, -2%) scale(1);
            opacity: 0.3;
          }
        }

        @keyframes rabbit-hole-ripple-expand {
          0% {
            transform: scale(0);
            opacity: 0.5;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 opacity-20 dark:opacity-15">
      {/* Base gradient background - Kinfolk muted beiges and soft grays */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(210, 205, 195, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(200, 195, 185, 0.12) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(220, 215, 205, 0.08) 0%, transparent 50%)
          `,
          animation: "rabbit-hole-ambient-shift 20s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}

