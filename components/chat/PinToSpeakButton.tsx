"use client";

import { useState, useCallback } from "react";
import { Button } from "@heroui/button";
import { Pin, Check } from "lucide-react";
import { toast } from "sonner";
import { addPinnedFromChat } from "@/lib/tts/pinned-to-speak";

export function PinToSpeakButton({ text }: { text: string }) {
  const [isPinned, setIsPinned] = useState(false);

  const handlePin = useCallback(async () => {
    if (!text.trim()) return;
    try {
      await addPinnedFromChat(text);
      setIsPinned(true);
      toast.success("Pinned to Speak", {
        description: "Open the Speak page to generate audio or download.",
        action: {
          label: "Open Speak",
          onClick: () => window.open("/speak", "_self"),
        },
      });
      setTimeout(() => setIsPinned(false), 2000);
    } catch (err) {
      console.warn("Pin to Speak failed:", err);
      toast.error("Failed to pin to Speak");
    }
  }, [text]);

  return (
    <Button
      className="text-secondary-foreground hover:scale-110 border touch-none"
      isIconOnly
      size="sm"
      variant="ghost"
      onPress={handlePin}
      aria-label={isPinned ? "Pinned to Speak" : "Pin to Speak page"}
    >
      {isPinned ? <Check className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
    </Button>
  );
}
