"use client";

import { useState } from "react";
import Page from "@/components/layout/page";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import { DimLevelDisplay } from "@/components/pages/background-test-dim-display";

const REST_DELAY_MS = 2400;

/**
 * Test page for AdaptiveLiquidChrome. Hover or focus the demo controls to see
 * the background dim; the display shows dim level in real time. Toggle light/dark
 * in the top-right to compare.
 */
export default function BackgroundTestPage() {
  const [dimmed, setDimmed] = useState(false);

  return (
    <Page transparentBackground>
      <AdaptiveLiquidChrome dimIntensity={0.45} onDimChange={setDimmed} />
      <div className="relative z-10 flex flex-col items-center justify-center gap-8 p-6">
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          AdaptiveLiquidChrome — hover or focus the controls to see the
          background dim. The meter shows dim level in real time. Toggle
          light/dark in the top-right.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-6 w-full max-w-md justify-center">
          <div className="flex flex-col items-center gap-4 w-full max-w-xs">
            <Button variant="outline" size="lg" data-dim-background>
              Hover me
            </Button>
            <Input
              type="text"
              placeholder="Focus me to dim the background"
              className="w-full"
              data-dim-background
            />
          </div>
          <DimLevelDisplay
            dimmed={dimmed}
            restDelayMs={REST_DELAY_MS}
            transitionMs={2500}
          />
        </div>
      </div>
    </Page>
  );
}
