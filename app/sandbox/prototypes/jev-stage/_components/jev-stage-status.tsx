"use client";

import { useEffect, useRef } from "react";

import { ChatThinking } from "@/components/chat/chat-loading";

// A one-shot text sweep near the upper end of the functional motion budget.
const STATUS_PULSE_MS = 480;
const rippleMask = {
  maskImage:
    "linear-gradient(110deg, black 42%, color-mix(in srgb, black 78%, transparent) 50%, black 58%)",
  maskSize: "250% 100%",
  maskRepeat: "no-repeat",
};

export function JevStageStatus({
  text,
  pulse,
  working,
  className,
}: {
  text: string;
  pulse: number;
  working: boolean;
  className: string;
}) {
  const label = useRef<HTMLSpanElement>(null);
  const animation = useRef<Animation | null>(null);

  useEffect(() => {
    const element = label.current;

    if (
      !pulse ||
      !element?.animate ||
      animation.current?.playState === "running" ||
      !window.CSS?.supports("mask-image", rippleMask.maskImage) ||
      window.matchMedia("(prefers-reduced-motion: reduce), (forced-colors: active)").matches
    ) {
      return;
    }

    animation.current = element.animate(
      [
        { ...rippleMask, maskPosition: "100% 0" },
        { ...rippleMask, maskPosition: "0% 0" },
      ],
      STATUS_PULSE_MS
    );
  }, [pulse]);

  return (
    <p aria-live={working ? undefined : "polite"} className={className} title={text}>
      <span ref={label} className="inline-block max-w-full">
        {working ? <ChatThinking as="span" text={text} /> : text}
      </span>
    </p>
  );
}
