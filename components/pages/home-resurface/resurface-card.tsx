"use client";

import type { ResurfaceCard as ResurfaceCardData } from "@/lib/resurface/schema";

import Link from "next/link";

import { RESURFACE_CARD_HEIGHT, RESURFACE_CARD_WIDTH } from "./resurface-layout";
import { ResurfaceVoiceStart } from "./resurface-voice-start";

import { glassPreview } from "@/components/design-system/primitives";
import { RESURFACE_KIND_LABEL } from "@/lib/resurface/schema";
import { cn } from "@/lib/utils";

const TITLE_CLASS = "line-clamp-2 break-words text-sm font-medium leading-5 text-foreground/90";

/**
 * One resurfaced thought. Two targets: the title opens where the thought lives (memories have no
 * page, so theirs is plain text), and the voice start opens a call about it.
 */
export function ResurfaceCard({
  card,
  voicePending,
  voiceError = null,
  onTalk,
}: {
  card: ResurfaceCardData;
  voicePending: boolean;
  /**
   * Why the last call from this card did not start. The live bar is gone by then, so this card is
   * the only place left to say so. The full reason is the tooltip; the footer has room for less.
   */
  voiceError?: string | null;
  /** Absent when Speak is off for this deployment; the voice start is not shown. */
  onTalk?: () => void;
}) {
  return (
    <article
      className={cn(
        glassPreview({ depth: "raised", border: "all", interactive: true }),
        "flex flex-col justify-between gap-2 rounded-2xl p-3"
      )}
      data-resurface-card=""
      data-resurface-kind={card.kind}
      style={{ width: RESURFACE_CARD_WIDTH, height: RESURFACE_CARD_HEIGHT }}
    >
      <h3 className="min-w-0">
        {card.href ? (
          <Link
            className={cn(
              TITLE_CLASS,
              "rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            )}
            href={card.href}
            title={card.title}
          >
            {card.title}
          </Link>
        ) : (
          <span className={TITLE_CLASS} title={card.title}>
            {card.title}
          </span>
        )}
      </h3>

      <div className="flex items-center justify-between gap-2">
        <span
          aria-live="polite"
          className="truncate text-2xs tracking-wide text-muted-foreground uppercase"
          title={voiceError ?? undefined}
        >
          {voiceError ? (
            <>
              Couldn’t start voice<span className="sr-only">: {voiceError}</span>
            </>
          ) : (
            RESURFACE_KIND_LABEL[card.kind]
          )}
        </span>
        {onTalk ? (
          <ResurfaceVoiceStart label={card.title} pending={voicePending} onStart={onTalk} />
        ) : null}
      </div>
    </article>
  );
}
