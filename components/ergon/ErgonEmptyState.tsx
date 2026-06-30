"use client";

import { CalendarDays, CheckCircle2, ListTodo, Sparkles } from "lucide-react";

import { ChatStyleCard } from "@/components/chat/chat-style-card";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const STARTER_CARDS = [
  {
    icon: <ListTodo className="size-4" />,
    label: "Plan today",
    description: "Capture what you want to get done today.",
    prompt: "Plan my day with a few focused tasks.",
  },
  {
    icon: <CalendarDays className="size-4" />,
    label: "Schedule",
    description: "Separate deadlines from do-dates.",
    prompt: "Book the dentist next week, ~30 min, low effort.",
  },
  {
    icon: <CheckCircle2 className="size-4" />,
    label: "Quick capture",
    description: "Dump everything — sort later.",
    prompt: "Add a quick errand list for this week.",
  },
] as const;

type ErgonEmptyStateProps = {
  onStarterSelect?: (prompt: string) => void;
};

export function ErgonEmptyState({ onStarterSelect }: ErgonEmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-1 py-8 sm:gap-5">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <div
          className={cn(
            "grid place-items-center rounded-xl border border-border/50 p-3",
            glass({ opaque: true })
          )}
        >
          <Sparkles aria-hidden className="size-7 text-muted-foreground/80" strokeWidth={1.25} />
        </div>
        <div className="space-y-1">
          <h2 className="font-commissioner text-lg font-light tracking-wide text-foreground sm:text-xl">
            Your planning space is clear
          </h2>
          <p className="max-w-sm text-xs leading-snug text-muted-foreground/80 sm:text-sm">
            Quick-add a task above, open the full editor, or pick a starter to shape your first
            plan.
          </p>
        </div>
      </div>

      <div className="grid w-full min-w-0 gap-2 sm:grid-cols-3 sm:items-stretch sm:gap-2.5 [&>*]:min-w-0">
        {STARTER_CARDS.map((card, index) => (
          <ChatStyleCard
            key={card.label}
            description={card.description}
            icon={card.icon}
            label={card.label}
            selected={index === 0}
            onSelect={() => onStarterSelect?.(card.prompt)}
          />
        ))}
      </div>
    </div>
  );
}
