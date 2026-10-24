"use client";

import { Button } from "@heroui/button";
import { Check, CheckIcon, Copy, Pin, Volume2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Loader } from "@/components/third-party/ai-elements/loader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import { glass } from "@/components/design-system/primitives";
import { useAssistantTtsAction } from "@/hooks/use-assistant-tts-action";
import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { addPinnedFromChat } from "@/lib/tts/pinned-to-speak";
import { cn } from "@/lib/utils";

/** Matches `glass({ opaque: true })` affordance for hover / focus-visible on icon triggers. */
const messageActionGlassHover =
  "hover:bg-background-tertiary/75 dark:hover:bg-background-tertiary/75 hover:backdrop-blur-2xl hover:backdrop-brightness-110 dark:hover:backdrop-brightness-200 hover:border-foreground/10";

const messageActionButtonClass = cn(
  "h-8 w-8 min-w-8 touch-none shrink-0 rounded-md border border-border/30 bg-transparent text-foreground transition-all duration-200",
  messageActionGlassHover,
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "active:scale-95"
);

const tooltipGlassClass = cn(
  glass({ opaque: true }),
  "border border-border/50 text-foreground shadow-md",
  "[&>svg:last-of-type]:hidden"
);

function MessageActionIconButton({
  ariaLabel,
  tooltip,
  onPress,
  disabled,
  ariaBusy,
  children,
}: {
  ariaLabel: string;
  tooltip: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  ariaBusy?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-busy={ariaBusy}
          aria-label={ariaLabel}
          className={messageActionButtonClass}
          isDisabled={disabled}
          isIconOnly
          size="sm"
          tabIndex={-1}
          variant="ghost"
          onPress={onPress}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent className={tooltipGlassClass} side="top" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

const TTS_ARIA = "Read aloud";
const PIN_ARIA = "Pin to Speak — save on the Speak page to generate or download audio.";
const COPY_ARIA = "Copy this message.";

export function AssistantMessageActions({
  text,
  showPinAndCopy,
}: {
  text: string;
  showPinAndCopy: boolean;
}) {
  const { handleSpeak, isProcessingThisClip, showOverlay } = useAssistantTtsAction(text);
  const [pinAck, setPinAck] = useState(false);
  const [copied, setCopied] = useState(false);

  const handlePin = useCallback(async () => {
    if (!text.trim()) return;
    try {
      await addPinnedFromChat(text);
      setPinAck(true);
      toast.success("Pinned to Speak", {
        description: "Open the Speak page to generate audio or download.",
        action: {
          label: "Open Speak",
          onClick: () => window.open("/speak", "_self"),
        },
      });
      setTimeout(() => setPinAck(false), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console -- surfaced via toast; log aids debugging
      console.warn("Pin to Speak failed:", err);
      toast.error("Failed to pin to Speak");
    }
  }, [text]);

  const handleCopy = useCallback(async () => {
    try {
      const ok = await copyTextToClipboard(text);

      if (!ok) throw new Error("copy failed");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    } catch (err) {
      // eslint-disable-next-line no-console -- surfaced via toast; log aids debugging
      console.warn("Clipboard write failed:", err);
      toast.error("Failed to copy to clipboard");
    }
  }, [text]);

  return (
    <div className="w-full flex gap-2 h-8">
      <div className="relative inline-flex">
        <MessageActionIconButton
          ariaBusy={isProcessingThisClip}
          ariaLabel={TTS_ARIA}
          disabled={isProcessingThisClip}
          tooltip={
            <span className="text-xs text-balance">
              <span className="font-medium text-foreground">{TTS_ARIA}</span>
              <span className="mt-1 block text-muted-foreground font-normal leading-snug">
                Uses your TTS settings (whole message or first section).
              </span>
            </span>
          }
          onPress={handleSpeak}
        >
          {isProcessingThisClip ? (
            <Loader className="size-4 shrink-0" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </MessageActionIconButton>

        <div
          className={cn(
            glass(),
            "absolute top-10 md:top-4 left-1/2 z-10 -translate-x-1/2 flex items-center gap-2 px-6 py-2 rounded-xl transition-opacity pointer-events-none",
            showOverlay ? "visible opacity-100" : "invisible opacity-0"
          )}
        >
          {showOverlay && (
            <div className="flex items-center gap-2 shrink-0">
              <Loader className="w-5 h-5 shrink-0" />
              <span className="text-sm text-foreground">Loading audio…</span>
            </div>
          )}
        </div>
      </div>

      {showPinAndCopy ? (
        <>
          <MessageActionIconButton ariaLabel={PIN_ARIA} tooltip={PIN_ARIA} onPress={handlePin}>
            {pinAck ? <Check className="size-4" /> : <Pin className="size-4" />}
          </MessageActionIconButton>
          <MessageActionIconButton ariaLabel={COPY_ARIA} tooltip={COPY_ARIA} onPress={handleCopy}>
            {copied ? <CheckIcon className="size-4" /> : <Copy className="size-4" />}
          </MessageActionIconButton>
        </>
      ) : null}
    </div>
  );
}
