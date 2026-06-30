"use client";

import { LayoutGrid, MessagesSquare, NotebookPen, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { FeatureHint } from "@/components/onboarding/feature-hint";
import { glass } from "@/components/design-system/primitives";
import { CHAT_STYLES, type ChatStyle } from "@/lib/chat/chat-style";
import { CHAT_STYLE_STARTERS } from "@/lib/chat/chat-style-starters";
import { setChatStyle, useChatStyle } from "@/lib/chat/chat-style-store";
import { cn } from "@/lib/utils";

import { ChatStyleCard } from "./chat-style-card";

const STYLE_ICONS: Record<ChatStyle, React.ReactNode> = {
  default: <MessagesSquare className="size-4" />,
  ergon: <LayoutGrid className="size-4" />,
  scribe: <NotebookPen className="size-4" />,
};

const PROMPT_MOTION = { duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] as const };

/** Fixed slot for three starter rows — cross-fade without changing page height. */
const STARTER_PROMPTS_SLOT_H = "h-[8.75rem] sm:h-[9.25rem]";

type ChatStylePickerProps = {
  chatId?: string;
  /** Fills the thread composer when a starter prompt is chosen. */
  onStarterSelect?: (prompt: string) => void;
};

/** Arcadia empty state — compact, fits above composer without scrolling. */
export function ChatStylePicker({ chatId, onStarterSelect }: ChatStylePickerProps) {
  const selected = useChatStyle(chatId ?? "");
  const starters = CHAT_STYLE_STARTERS[selected];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-1 sm:gap-5">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <div
          className={cn(
            "grid place-items-center rounded-xl border border-border/50 p-3",
            glass({ opaque: true })
          )}
        >
          <Sparkles
            aria-hidden
            className="size-7 text-muted-foreground/80"
            strokeWidth={1.25}
          />
        </div>
        <div className="space-y-1">
          <h2 className="font-commissioner text-lg font-light tracking-wide text-foreground sm:text-xl">
            Choose how you want to work
          </h2>
          <p className="max-w-sm text-xs leading-snug text-muted-foreground/80 sm:text-sm">
            Pick a style or type below. Tools appear when they help.
          </p>
        </div>
      </div>

      <div
        aria-label="Chat style"
        className="grid w-full min-w-0 gap-2 sm:grid-cols-3 sm:items-stretch sm:gap-2.5 [&>*]:min-w-0"
        role="radiogroup"
      >
        {CHAT_STYLES.map((style) => (
          <ChatStyleCard
            key={style.id}
            description={style.description}
            icon={STYLE_ICONS[style.id]}
            label={style.label}
            selected={selected === style.id}
            onSelect={() => chatId && setChatStyle(chatId, style.id)}
          />
        ))}
      </div>

      <div className="w-full min-w-0 space-y-2 text-left">
        <FeatureHint id="arcadia-starters">
          <p className="text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 sm:text-xs">
            Starter prompts
          </p>
        </FeatureHint>
        <div className={cn("relative w-full", STARTER_PROMPTS_SLOT_H)}>
          <AnimatePresence initial={false}>
            <motion.ul
              key={selected}
              animate={{ opacity: 1, x: 0 }}
              className="absolute inset-0 flex w-full flex-col gap-1.5 sm:gap-2"
              exit={{ opacity: 0, x: 8 }}
              initial={{ opacity: 0, x: -8 }}
              transition={PROMPT_MOTION}
            >
              {starters.map((prompt, index) => (
                <motion.li
                  key={prompt}
                  animate={{ opacity: 1, x: 0 }}
                  className="min-h-0 min-w-0"
                  initial={{ opacity: 0, x: -10 }}
                  transition={{ ...PROMPT_MOTION, delay: index * 0.04 }}
                >
                  <button
                    className={cn(
                      "line-clamp-2 w-full min-w-0 cursor-pointer rounded-lg border border-border/50 px-3 py-2 text-left text-xs leading-snug text-foreground/90 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm",
                      glass({ opaque: true }),
                      "hover:border-[color:rgb(var(--lumen-rim)/0.2)] hover:text-foreground",
                      "motion-safe:hover:translate-x-0.5 motion-safe:active:scale-[0.995]"
                    )}
                    type="button"
                    onClick={() => onStarterSelect?.(prompt)}
                  >
                    {prompt}
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
