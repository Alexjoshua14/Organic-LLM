"use client";

import { Check, LayoutGrid, MessagesSquare, NotebookPen } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { CHAT_STYLES, type ChatStyle } from "@/lib/chat/chat-style";
import { setChatStyle, useChatStyle } from "@/lib/chat/chat-style-store";
import { cn } from "@/lib/utils";

const STYLE_ICONS: Record<ChatStyle, React.ReactNode> = {
  default: <MessagesSquare className="size-5" />,
  ergon: <LayoutGrid className="size-5" />,
  scribe: <NotebookPen className="size-5" />,
};

type ChatStylePickerProps = {
  chatId?: string;
};

/** New-chat style selector shown in the empty Arcadia state. */
export function ChatStylePicker({ chatId }: ChatStylePickerProps) {
  const selected = useChatStyle(chatId ?? "");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 py-10 text-center">
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">Start a conversation</h2>
        <p className="text-sm text-muted-foreground">
          Pick a chat style. You can just type below, or let the assistant run a structured flow.
        </p>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Chat style">
        {CHAT_STYLES.map((style) => {
          const isSelected = selected === style.id;

          return (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => chatId && setChatStyle(chatId, style.id)}
              className={cn(
                glass({ opaque: true }),
                "group relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                isSelected
                  ? "border-accent/60 ring-1 ring-accent/40"
                  : "border-border/50 hover:border-accent/30"
              )}
            >
              <span className="flex w-full items-center justify-between">
                <span className="grid size-9 place-items-center rounded-md bg-background-tertiary/60 text-foreground">
                  {STYLE_ICONS[style.id]}
                </span>
                {isSelected ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Check className="size-3.5" />
                  </span>
                ) : null}
              </span>
              <span className="text-sm font-medium text-foreground">{style.label}</span>
              <span className="text-xs text-muted-foreground">{style.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
