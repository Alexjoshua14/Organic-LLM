"use client";

import type { ResurfaceCard as ResurfaceCardData, ResurfaceResponse } from "@/lib/resurface/schema";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { ResurfaceCard } from "./resurface-card";
import {
  RESURFACE_EASE,
  RESURFACE_ENTER_RISE_PX,
  RESURFACE_ENTER_S,
  RESURFACE_STAGGER_S,
} from "./resurface-layout";

import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { createLogger } from "@/lib/logger";

const logger = createLogger("home-resurface-section");

/**
 * Past thoughts, brought back under the homepage composer and ordered by Jev.
 *
 * Fetched after mount so it never holds up first paint, and renders nothing until there is
 * something to show — the shell owns the space, so an empty row leaves the composer where it was.
 * The row scrolls sideways when it outgrows the column (an open sidebar, a phone).
 */
export function HomeResurfaceSection() {
  const voice = useVoiceSessionOptional();
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<ResurfaceResponse | null>(null);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ cardId: string; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/homepage/resurface", { signal: controller.signal })
      .then(async (res) => (res.ok ? ((await res.json()) as ResurfaceResponse) : null))
      .then((body) => {
        if (body) setData(body);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) logger.warn("load", String(err));
      });

    return () => controller.abort();
  }, []);

  const connecting = voice?.connecting ?? false;
  const connected = voice?.connected ?? false;
  const voiceError = voice?.error ?? null;
  const wasConnectingRef = useRef(false);

  // When the connect a card started settles, its pending mark goes. If it failed — an expired
  // card, a spent budget, a denied mic — the live bar never appeared to say so, so the card does.
  useEffect(() => {
    const settled = wasConnectingRef.current && !connecting;

    wasConnectingRef.current = connecting;
    if (!settled || !pendingCardId) return;

    if (!connected && voiceError) setFailure({ cardId: pendingCardId, message: voiceError });
    setPendingCardId(null);
  }, [connecting, connected, voiceError, pendingCardId]);

  if (!data || data.cards.length === 0) return null;

  const talk = (card: ResurfaceCardData) => {
    if (!voice) return;

    setFailure(null);
    setPendingCardId(card.id);
    void voice.talkAboutThought(card);
  };

  return (
    <section aria-label="Thoughts to revisit" className="w-full" data-home-resurface="">
      <div className="w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain py-8 [scrollbar-width:none]">
        <ul className="mx-auto flex w-max gap-3 px-4">
          {data.cards.map((card, i) => (
            <motion.li
              key={card.id}
              animate={{ opacity: 1, y: 0 }}
              className="shrink-0 snap-start"
              initial={{ opacity: 0, y: reduceMotion ? 0 : RESURFACE_ENTER_RISE_PX }}
              transition={{
                duration: RESURFACE_ENTER_S,
                ease: RESURFACE_EASE,
                delay: reduceMotion ? 0 : i * RESURFACE_STAGGER_S,
              }}
            >
              <ResurfaceCard
                card={card}
                voiceError={failure?.cardId === card.id ? failure.message : null}
                voicePending={pendingCardId === card.id && connecting}
                onTalk={data.voiceEnabled && voice ? () => talk(card) : undefined}
              />
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
