"use client";
import { useTheme } from "next-themes";

import { LiquidChrome as LiquidChromeComponent } from "@/components/third-party/reactbits/LiquidChrome/LiquidChrome";

interface LiquidChromeProps {
  speed?: number;
}

export default function LiquidChrome({ speed = 0.03 }: LiquidChromeProps) {
  const { theme } = useTheme();

  const baseColor: [number, number, number] =
    theme === "dark" ? [0.03, 0.05, 0.07] : [0.45, 0.54, 0.6];

  return (
    <div
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
      <LiquidChromeComponent
        amplitude={0.2}
        baseColor={baseColor}
        interactive={true}
        speed={speed}
      />
    </div>
  );
}
