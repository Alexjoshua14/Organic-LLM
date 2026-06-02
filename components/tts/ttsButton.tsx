"use client";

import { Button } from "@heroui/button";
import { Volume2 } from "lucide-react";

import { Loader } from "../third-party/ai-elements/loader";
import { glass } from "../design-system/primitives";

import { useAssistantTtsAction } from "@/hooks/use-assistant-tts-action";
import { cn } from "@/lib/utils";

export function TTSButton({ text, iconOnly }: { text: string; iconOnly?: boolean }) {
  const { handleSpeak, isProcessingThisClip, showOverlay, showTapNativePlayHint } =
    useAssistantTtsAction(text);

  return (
    <>
      <Button
        aria-busy={isProcessingThisClip}
        className="text-accent hover:scale-110 border touch-none"
        isDisabled={isProcessingThisClip}
        isIconOnly={iconOnly}
        size="sm"
        tabIndex={-1}
        variant="ghost"
        onPress={handleSpeak}
      >
        {isProcessingThisClip ? (
          <Loader className="w-4 h-4 mr-1 shrink-0" />
        ) : (
          <Volume2 className="w-4 h-4 mr-1" />
        )}
        {iconOnly ? null : isProcessingThisClip ? "Loading…" : "Play Audio"}
      </Button>
      <div
        className={cn(
          glass(),
          "absolute top-10 md:top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-2 rounded-xl transition-opacity",
          showOverlay ? "visible opacity-100" : "invisible pointer-events-none opacity-0"
        )}
      >
        {isProcessingThisClip && (
          <div className="flex items-center gap-2 shrink-0">
            <Loader className="w-5 h-5 shrink-0" />
            <span className="text-sm text-foreground">Loading audio…</span>
          </div>
        )}
        {showTapNativePlayHint && (
          <div className="flex items-center gap-2 shrink-0 max-w-[min(280px,85vw)]">
            <Volume2 className="w-5 h-5 shrink-0 text-accent" aria-hidden />
            <span className="text-sm text-foreground">Tap play in the player below.</span>
          </div>
        )}
      </div>
    </>
  );
}
