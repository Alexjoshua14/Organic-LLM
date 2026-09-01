"use client";

import { motion } from "framer-motion";
import { MessageCircle, Rabbit, Sparkles } from "lucide-react";

import { FeatureHint } from "@/components/onboarding/feature-hint";
import { cn } from "@/lib/utils";

interface RabbitHoleEmptyStateProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  onExplore?: (question: string) => void | Promise<void>;
  /** Sends a starter line to the session chat (not article generation). */
  onStarterPrompt?: (question: string) => void | Promise<void>;
}

const defaultTitle = "Start exploring a topic";
const defaultSubtitle =
  "Chat in the drawer, explore an article, or branch deeper as you go.";

const STARTER_PROMPTS = [
  "What should I explore first?",
  "How does this topic connect to everyday life?",
  "Give me a surprising angle to research",
] as const;

export function RabbitHoleEmptyState({
  title = defaultTitle,
  subtitle = defaultSubtitle,
  compact = false,
  onExplore,
  onStarterPrompt,
}: RabbitHoleEmptyStateProps) {
  const sendStarter = onStarterPrompt ?? onExplore;
  return (
    <FeatureHint id="rabbit-holes-focus" showWhen={!compact}>
      <motion.div
        key="empty"
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex min-h-[280px] flex-col items-center justify-center px-8 text-center",
          compact && "min-h-[200px] px-5"
        )}
        exit={{ opacity: 0 }}
        initial={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.35 }}
      >
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 rounded-2xl border border-border/50 bg-muted/20 p-6"
          initial={{ opacity: 0, scale: 0.96 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <Rabbit aria-hidden className="h-10 w-10 text-muted-foreground/70" strokeWidth={1.25} />
        </motion.div>
        <p className="font-commissioner mb-3 text-xl font-light tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground/70">{subtitle}</p>

        <ul className="mt-6 flex max-w-md flex-col gap-2 text-left text-sm text-muted-foreground/80">
          <li className="inline-flex items-start gap-2">
            <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Ask the assistant in the drawer — one turn at a time, swipe for history.</span>
          </li>
          <li className="inline-flex items-start gap-2">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Explore a question to open your first article node.</span>
          </li>
          <li className="inline-flex items-start gap-2">
            <Rabbit aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Follow branches from the grid when you want to go deeper.</span>
          </li>
        </ul>

        {sendStarter ? (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="rounded-full border border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                type="button"
                onClick={() => {
                  void sendStarter(prompt);
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        {!compact && (
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted-foreground/55">
            ⌘⇧F (Ctrl+Shift+F) toggles focus mode — hides the path, sources, and prompt for
            reading.
          </p>
        )}
      </motion.div>
    </FeatureHint>
  );
}
