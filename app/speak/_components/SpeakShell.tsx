"use client";

import { useState } from "react";

import { LiveVoiceStage } from "./LiveVoiceStage";
import { ReadAloudStage } from "./ReadAloudStage";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";

export type SpeakMode = "live" | "read";

export function SpeakShell() {
  const [mode, setMode] = useState<SpeakMode>("live");

  return (
    <Page chrome="full-bleed" liquidChromeBackground transparentBackground className="!items-stretch !justify-stretch overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.5} dimIntensityFull={0.65} />
      <div className="relative z-10 flex h-full min-h-0 w-full flex-col">
        {mode === "live" ? (
          <LiveVoiceStage onExit={() => setMode("read")} />
        ) : (
          <ReadAloudStage onExit={() => setMode("live")} />
        )}
      </div>
    </Page>
  );
}
