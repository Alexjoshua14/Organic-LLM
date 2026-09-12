"use client";

import { Volume2 } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { ComposerToolChip } from "@/components/chat/composer-tool-chip";

export function ComposerSpeechChip() {
  const { useSpeechFriendly, setUseSpeechFriendly } = useCoreInputControls();

  return (
    <ComposerToolChip
      active={useSpeechFriendly}
      aria-label={useSpeechFriendly ? "Speech-friendly on" : "Speech-friendly off"}
      chip="speech"
      title="Format replies for reading and TTS; a separate pipeline converts to speech-friendly script."
      onClick={() => setUseSpeechFriendly(!useSpeechFriendly)}
    >
      <Volume2 size={16} />
    </ComposerToolChip>
  );
}
