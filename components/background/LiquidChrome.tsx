"use client";
import { LiquidChrome as LiquidChromeComponent } from "@/components/third-party/reactbits/LiquidChrome/LiquidChrome";

interface LiquidChromeProps {
  speed?: number;
}

export default function LiquidChrome({ speed = 0.05 }: LiquidChromeProps) {
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
        amplitude={0.42}
        baseColor={[0.05, 0.08, 0.1]}
        interactive={true}
        speed={speed}
      />
    </div>
  );
}
