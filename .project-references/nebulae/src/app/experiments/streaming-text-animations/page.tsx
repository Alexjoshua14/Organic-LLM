"use client";

import { useState } from "react";
import { BackLink } from "@/foundations/layout";
import { PrototypeSelector } from "@/experiments/streaming-text-animations/components/PrototypeSelector";
import { PrototypeDisplay } from "@/experiments/streaming-text-animations/components/PrototypeDisplay";
import { PrototypeConfig } from "@/experiments/streaming-text-animations/components/prototypes/types";

const prototypes: PrototypeConfig[] = [
  {
    id: "typewriter",
    name: "Typewriter",
    description:
      "Stream text with configurable granularity (character, word, line, sentence)",
  },
  {
    id: "ripple",
    name: "Ripple",
    description:
      "Color wave effect - characters transition from highlight to base color",
  },
];

export default function StreamingTextAnimationsPage() {
  const [selectedPrototype, setSelectedPrototype] =
    useState<string>("typewriter");

  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-8 md:p-10 lg:p-12 pt-14 sm:pt-16 md:pt-20 lg:pt-20 bg-linear-to-br from-neutral-100 via-neutral-50 to-neutral-200 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-800">
      <div className="w-full max-w-5xl flex flex-col gap-10">
        {/* Back link and Header */}
        <div className="flex flex-col gap-3">
          <BackLink href="/experiments" label="Back to Experiments" />

          {/* Header */}
          <div className="text-center flex flex-col gap-2">
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-neutral-900 dark:text-neutral-50">
              Streaming Text Animations
            </h1>
            <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400">
              Prototype micro-animations for streaming text with different
              granularities
            </p>
          </div>
        </div>

        {/* Selector and Display */}
        <div className="flex flex-col gap-4">
          {/* Prototype Selector */}
          <div className="flex justify-center">
            <PrototypeSelector
              value={selectedPrototype}
              onChange={setSelectedPrototype}
              prototypes={prototypes}
            />
          </div>

          {/* Prototype Display */}
          <PrototypeDisplay prototypeId={selectedPrototype} />
        </div>
      </div>
    </div>
  );
}

