"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { ChatModel } from "@/lib/schemas/chat";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";

import { createContext, useContext } from "react";

export type InputMarkdownMode = "edit" | "preview";

export type CoreInputControlsValue = {
  /** Footer is wide enough to show text labels next to chip icons. */
  showLabels: boolean;
  /** Compact variant or narrow footer: icon-only chips, secondary tools move to the overflow menu. */
  useCondensedLayout: boolean;
  useWebSearch: boolean;
  setUseWebSearch: Dispatch<SetStateAction<boolean>>;
  useMemories: boolean;
  setUseMemories: Dispatch<SetStateAction<boolean>>;
  useSpeechFriendly: boolean;
  setUseSpeechFriendly: Dispatch<SetStateAction<boolean>>;
  inputMarkdownMode: InputMarkdownMode;
  setInputMarkdownMode: Dispatch<SetStateAction<InputMarkdownMode>>;
  model: ChatModel;
  selectableModels: ChatModel[];
  onModelChange: (id: string) => void;
  effort: ChatEffortLevel;
  onEffortChange: (id: string) => void;
};

const CoreInputControlsContext = createContext<CoreInputControlsValue | null>(null);

export function CoreInputControlsProvider({
  value,
  children,
}: {
  value: CoreInputControlsValue;
  children: ReactNode;
}) {
  return (
    <CoreInputControlsContext.Provider value={value}>{children}</CoreInputControlsContext.Provider>
  );
}

export function useCoreInputControls(): CoreInputControlsValue {
  const value = useContext(CoreInputControlsContext);

  if (!value) {
    throw new Error("useCoreInputControls must be used inside CoreInputControlsProvider");
  }

  return value;
}
