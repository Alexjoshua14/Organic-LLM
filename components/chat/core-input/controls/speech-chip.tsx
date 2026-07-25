"use client";

import { Volume2 } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { ComposerToolChip } from "@/components/chat/composer-tool-chip";
import { cn } from "@/lib/utils";

export function ComposerSpeechChip() {
  const { showLabels, useSpeechFriendly, setUseSpeechFriendly } = useCoreInputControls();

  return (
    <ComposerToolChip
      active={useSpeechFriendly}
      aria-label={useSpeechFriendly ? "Speech-friendly on" : "Speech-friendly off"}
      title="Format replies for reading and TTS; a separate pipeline converts to speech-friendly script."
      tool="speech"
      onClick={() => setUseSpeechFriendly(!useSpeechFriendly)}
    >
      <Volume2 size={16} />
      <span className={cn(showLabels ? "inline-flex" : "hidden")}>Speech</span>
    </ComposerToolChip>
  );
}
