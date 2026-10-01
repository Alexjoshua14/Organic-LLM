"use client";

import { Camera, Check, Loader2, Plus } from "lucide-react";
import { useRef, useState, type ReactElement } from "react";

import { PaintingStateSummary } from "./painting-state-summary";
import { PersonaSpark } from "./persona-spark";
import { usePersonaSessionOptional } from "./persona-session-provider";

import { Button } from "@/components/third-party/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/third-party/ui/dialog";
import { PERSONAS, PERSONA_STARTERS } from "@/lib/personas/unified/registry";
import { cn } from "@/lib/utils";

/**
 * Choosing a persona and steering its session: on/off, what is being painted, starters, and
 * progress photos. One panel, opened from the composer chip in chat and the Speak toolbar.
 */
export function PersonaPanel({
  trigger,
  locked = false,
}: {
  /** The element that opens the panel; rendered via `DialogTrigger asChild`. */
  trigger: ReactElement;
  /** A live voice call has the persona baked in; switching waits until it ends. */
  locked?: boolean;
}) {
  const persona = usePersonaSessionOptional();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);

  if (!persona) return null;
  const { session, busy, error, photo } = persona;
  const artist = PERSONAS["artist-assistant"];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSubject(session?.subject ?? "");
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personas</DialogTitle>
          <DialogDescription>A persona stays with you across chat and voice.</DialogDescription>
        </DialogHeader>

        <button
          aria-pressed={Boolean(session)}
          className={cn(
            "flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
            session
              ? "border-teal-500/40 bg-teal-500/5"
              : "border-border hover:bg-background-tertiary/60"
          )}
          disabled={busy || locked}
          type="button"
          onClick={() => void (session ? persona.disable() : persona.enable())}
        >
          <PersonaSpark size={40} state={session ? "idle" : "inactive"} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{artist.name}</span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              {artist.tagline}
            </span>
          </span>
          {busy ? (
            <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
          ) : session ? (
            <Check aria-hidden className="size-4 text-teal-600 dark:text-teal-300" />
          ) : null}
        </button>
        {locked ? (
          <p className="text-xs text-muted-foreground">End the voice call to switch personas.</p>
        ) : null}

        {session ? (
          <div className="space-y-5 border-t border-border pt-4">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">What are you painting?</h3>
              <div className="flex flex-wrap gap-2">
                {PERSONA_STARTERS.map((starter) => (
                  <button
                    key={starter.id}
                    aria-pressed={session.starterId === starter.id}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      session.starterId === starter.id
                        ? "border-teal-500/40 bg-teal-500/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                    disabled={busy}
                    title={starter.blurb}
                    type="button"
                    onClick={() => void persona.chooseStarter(starter.id)}
                  >
                    {starter.label}
                  </button>
                ))}
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void persona.setSubject(subject);
                }}
              >
                <label className="sr-only" htmlFor="persona-subject">
                  Describe what you are painting
                </label>
                <input
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-background-secondary/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  id="persona-subject"
                  maxLength={500}
                  placeholder="Or describe it in your own words"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
                <Button
                  disabled={busy || !subject.trim() || subject.trim() === session.subject}
                  size="sm"
                  type="submit"
                  variant="secondary"
                >
                  Save
                </Button>
              </form>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Your painting</h3>
              <input
                ref={photoInput}
                accept="image/jpeg,image/png,image/webp"
                aria-label="Progress photo of your painting"
                className="hidden"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) void persona.analyzePhoto(file);
                  event.target.value = "";
                }}
              />
              <Button
                className="w-full"
                disabled={photo.state === "analyzing"}
                type="button"
                variant="outline"
                onClick={() => photoInput.current?.click()}
              >
                {photo.state === "analyzing" ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Camera aria-hidden className="size-4" />
                )}
                {photo.state === "analyzing"
                  ? "Reading your painting…"
                  : session.work
                    ? "Add a progress photo"
                    : "Add a photo of your painting"}
              </Button>
              {photo.message ? (
                <p
                  aria-live="polite"
                  className={cn(
                    "text-xs",
                    photo.state === "error" ? "text-destructive" : "text-muted-foreground"
                  )}
                  role="status"
                >
                  {photo.message}
                </p>
              ) : null}
              {session.work ? (
                <PaintingStateSummary state={session.work} />
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your assistant keeps track of colours, values and what changed between photos.
                  Same angle and light each time makes the comparison sharper.
                </p>
              )}
            </section>

            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Asides and sighs are heard, not answered.
              </p>
              <Button
                disabled={busy}
                size="sm"
                title="Start a new painting session; the current one is kept"
                type="button"
                variant="ghost"
                onClick={() => void persona.startFresh()}
              >
                <Plus aria-hidden className="size-3.5" />
                New painting
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
