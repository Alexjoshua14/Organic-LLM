"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function JevStageMessage({ text }: { text: string }) {
  const preview = useRef<HTMLParagraphElement>(null);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const element = preview.current;

    if (!element) return;
    const measure = () => setClipped(element.scrollHeight > element.clientHeight);
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(element);

    return () => observer.disconnect();
  }, [text]);

  return (
    <div className="mt-2 w-full max-w-sm space-y-1 px-2 text-center text-2xs text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
      <p ref={preview} className="line-clamp-2 whitespace-pre-wrap wrap-anywhere italic">
        {text}
      </p>
      {clipped && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="organic-focus underline underline-offset-2" type="button">
              Show full message
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              aria-label="Your sent message"
              className={cn(
                glass({ opaque: true }),
                "z-50 max-h-(--radix-popover-content-available-height) w-80 max-w-(--radix-popover-content-available-width) overflow-y-auto overscroll-contain rounded-xl p-4 text-left text-sm shadow-xl"
              )}
            >
              <Popover.Close className="organic-focus mb-2 text-xs underline underline-offset-2">
                Close message
              </Popover.Close>
              <p className="whitespace-pre-wrap wrap-anywhere">{text}</p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
