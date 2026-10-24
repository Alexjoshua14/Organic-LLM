"use client";
import { useMemo } from "react";
import { useTheme } from "next-themes";

import { LiquidChrome as LiquidChromeComponent } from "@/components/third-party/reactbits/LiquidChrome/LiquidChrome";
import { PAPER_INK_MATERIAL } from "@/lib/background/liquid-chrome-material";

interface LiquidChromeProps {
  speed?: number;
}

export default function LiquidChrome({ speed = 0.03 }: LiquidChromeProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const baseColor = useMemo<[number, number, number]>(
    () => (isDark ? [0.03, 0.05, 0.07] : PAPER_INK_MATERIAL.paperColor),
    [isDark]
  );

  return (
    <div
      className="liquid-chrome-fallback"
      style={{
        width: "100dvw",
        height: "100dvh",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {resolvedTheme && (
        <LiquidChromeComponent
          amplitude={isDark ? 0.2 : PAPER_INK_MATERIAL.amplitude}
          baseColor={baseColor}
          interactive={true}
          material={isDark ? "chrome" : "paper-ink"}
          speed={speed}
        />
      )}
    </div>
  );
}
