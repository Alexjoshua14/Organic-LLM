"use client";

import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { usePerfConsent } from "./use-perf-consent";

import { glassPreview } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { setPerfConsent } from "@/lib/perf/consent";
import { PERF_CODE_LINKS, PERF_PRIVACY_ANCHOR } from "@/lib/perf/disclosure-links";
import { cn } from "@/lib/utils";

/** Functional motion: brief in, faster out (docs/design/README.md principles). */
const NOTICE_ENTER_S = 0.24;
const NOTICE_EXIT_S = 0.16;

const link = "text-foreground underline decoration-foreground/40 hover:decoration-foreground";

/**
 * First-run notice for anonymous performance metrics. It appears once per account, when no choice
 * has been recorded yet. Collection starts only after the notice has painted (the choice is
 * recorded on the account as "on" then), and "Turn off" stops it at once. Every claim here is
 * backed by code the links point at; the field list on the Privacy page is generated from the
 * same schema the server validates against.
 */
export function PerfMetricsNotice() {
  const { isLoaded, isSignedIn } = useAuth();
  const state = usePerfConsent();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const claimed = useRef(false);
  const recorded = useRef(false);

  // Show once, when the server confirms no choice exists yet.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || state !== "unset" || claimed.current) return;
    claimed.current = true;
    setVisible(true);
  }, [isLoaded, isSignedIn, state]);

  // Start collecting only after the notice is on screen.
  useEffect(() => {
    if (!visible || recorded.current) return;
    recorded.current = true;

    const frame = requestAnimationFrame(() => {
      void setPerfConsent(true).then((ok) => {
        // If the choice cannot be saved, nothing is collected, so there is nothing to announce.
        if (!ok) setVisible(false);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const turnOff = async () => {
    setBusy(true);
    await setPerfConsent(false);
    setBusy(false);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.aside
          key="perf-metrics-notice"
          animate={{ opacity: 1, y: 0 }}
          aria-label="Anonymous performance metrics"
          exit={{ opacity: 0, y: reduceMotion ? 0 : 8, transition: { duration: NOTICE_EXIT_S } }}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
          transition={{ duration: NOTICE_ENTER_S, ease: [0.25, 0.1, 0.25, 1] }}
          className={cn(
            glassPreview(),
            "fixed inset-x-3 bottom-3 z-[205] rounded-xl p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[23rem]"
          )}
        >
          <h2 className="text-sm font-medium text-foreground">Anonymous speed metrics</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            I time things like opening a chat so I can make Organic faster. That&apos;s all this is:
            how long something took, the kind of page, and whether you&apos;re on a phone or a
            desktop. No names, messages, chat IDs or links, and nothing that points back to your
            account. Only admins can see the totals.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            <a className={link} href={PERF_PRIVACY_ANCHOR}>
              See exactly what&apos;s recorded
            </a>{" "}
            ·{" "}
            <a className={link} href={PERF_CODE_LINKS[0].href} rel="noreferrer" target="_blank">
              read the code that does it
            </a>
            . Change this any time in Settings → Privacy.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button disabled={busy} size="sm" variant="ghost" onClick={() => void turnOff()}>
              Turn off
            </Button>
            <Button size="sm" onClick={() => setVisible(false)}>
              Got it
            </Button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
