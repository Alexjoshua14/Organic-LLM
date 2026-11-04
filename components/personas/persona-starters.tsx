"use client";

import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import { useState } from "react";

import { PersonaSpark } from "./persona-spark";
import { usePersonaSessionOptional } from "./persona-session-provider";

import { PERSONA_STARTERS } from "@/lib/personas/unified/registry";
import { cn } from "@/lib/utils";

/**
 * Empty-session starters while the Artist assistant is on: pick what you are painting, or say
 * it in your own words. Shown in an empty chat and on the idle Speak stage.
 */
export function PersonaStarters({ compact = false }: { compact?: boolean }) {
  const persona = usePersonaSessionOptional();
  const [subject, setSubject] = useState("");

  if (!persona?.session) return null;
  const { session, busy, error } = persona;
  const custom = session.starterId === null && session.subject.trim().length > 0;

  return (
    <div className={cn("mx-auto w-full max-w-lg space-y-4", compact ? "px-0 py-2" : "px-2 py-6")}>
      {compact ? null : (
        <div className="flex items-center gap-3">
          <PersonaSpark size={44} state="idle" />
          <div>
            <h2 className="text-base font-medium">What are you painting?</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your assistant answers when you ask, and stays quiet when you don’t.
            </p>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {PERSONA_STARTERS.map((starter) => {
          const chosen = session.starterId === starter.id;

          return (
            <li key={starter.id}>
              <button
                aria-pressed={chosen}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  chosen
                    ? "border-teal-500/40 bg-teal-500/5"
                    : "border-border bg-background-secondary/40 hover:border-teal-500/30"
                )}
                disabled={busy}
                type="button"
                onClick={() => void persona.chooseStarter(starter.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{starter.label}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {starter.blurb}
                  </span>
                </span>
                {busy ? (
                  <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
                ) : chosen ? (
                  <Check aria-hidden className="size-4 text-teal-600 dark:text-teal-300" />
                ) : (
                  <ArrowUpRight aria-hidden className="size-4 text-muted-foreground" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void persona.setSubject(subject).then(() => setSubject(""));
        }}
      >
        <label className="sr-only" htmlFor="persona-starter-subject">
          Something else you are painting
        </label>
        <input
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="persona-starter-subject"
          maxLength={500}
          placeholder="Something else? Describe it"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
        <button
          className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-background-tertiary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          disabled={busy || !subject.trim()}
          type="submit"
        >
          Set
        </button>
      </form>

      {custom ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Painting:</span> {session.subject}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
