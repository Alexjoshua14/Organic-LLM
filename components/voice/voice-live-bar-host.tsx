"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { VoiceLiveBar } from "./voice-live-bar";
import {
  VOICE_BAR_EASE,
  VOICE_BAR_ENTER_MS,
  VOICE_BAR_EXIT_MS,
  VOICE_BAR_HEIGHT_PX,
} from "./voice-live-bar-timing";

import { useVoiceSession } from "./voice-session-provider";

/**
 * Places the live bar.
 *
 * Where CoreInput is mounted it claims the container (see `setBarContainer`) and the bar renders
 * as a drawer tucked behind the composer's top edge, sliding up into view. Where CoreInput is
 * absent — Arcadia, Strata, rabbit holes — it falls back to a fixed anchor at the same place on
 * screen, because "the mic is open" must not be a fact that some routes forget to mention.
 *
 * The slide-out illusion is a z-order trick, not a clip: the bar starts translated down by its
 * own height, sitting behind the composer, and animates to zero. No `overflow: hidden` is
 * involved, so the glass shadow is never cut off.
 */
export function VoiceLiveBarHost({ container }: { container: HTMLElement | null }) {
  const { connected, connecting, phase, startedAt, localStream, remoteStream, disconnect } =
    useVoiceSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const visible = connected || connecting;

  const bar = (
    <AnimatePresence>
      {visible ? (
        <motion.div
          animate={{ y: 0, opacity: 1 }}
          className="w-full"
          exit={{ y: VOICE_BAR_HEIGHT_PX, opacity: 0 }}
          initial={{ y: VOICE_BAR_HEIGHT_PX, opacity: 0 }}
          transition={{
            duration: (visible ? VOICE_BAR_ENTER_MS : VOICE_BAR_EXIT_MS) / 1000,
            ease: VOICE_BAR_EASE,
          }}
        >
          <VoiceLiveBar
            connecting={connecting}
            localStream={localStream}
            phase={phase}
            remoteStream={remoteStream}
            startedAt={startedAt}
            onEnd={disconnect}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (container) return createPortal(bar, container);

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-40 mx-auto flex w-full max-w-2xl justify-center px-4">
      {bar}
    </div>,
    document.body
  );
}
