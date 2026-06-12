"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";

import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import {
  DecryptedText,
  type DecryptedTextControlPhase,
} from "@/components/third-party/reactbits/DecryptedText/DecryptedText";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type WelcomeEncryptedAtRestIllustrationProps = {
  className?: string;
};

type PayloadStage = "thread" | "database";

const MESSAGE =
  "Open question from Noesis: does episodic memory help tool selection? Flag for main chat.";

const PLAIN_REST_MS = 2800;
const ENCRYPTED_HOLD_MS = 1400;
const STORED_REST_MS = 3200;
const LAYOUT_SETTLE_MS = 480;

const TEXT_SLOT_CLASS =
  "min-h-[4.75rem] font-mono text-[13px] leading-[1.55] sm:min-h-[5rem] sm:text-sm";

const LAYOUT_TRANSITION = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

export function WelcomeEncryptedAtRestIllustration({
  className,
}: WelcomeEncryptedAtRestIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const [stage, setStage] = useState<PayloadStage>("thread");
  const [controlPhase, setControlPhase] =
    useState<DecryptedTextControlPhase>("plain");
  const [frozenCipherText, setFrozenCipherText] = useState("");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const active = inView && pageVisible && !reduce;
  const motionActive = active && !reduce;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    if (!active) {
      clearTimers();
      setStage("thread");
      setControlPhase("plain");
      setFrozenCipherText("");
      return;
    }

    if (controlPhase !== "plain" || stage !== "thread") return;

    schedule(() => setControlPhase("encrypting"), PLAIN_REST_MS);

    return clearTimers;
  }, [active, clearTimers, controlPhase, schedule, stage]);

  const handleControlComplete = useCallback(
    (phase: "encrypted" | "plain", displayText: string) => {
      if (phase === "encrypted") {
        setFrozenCipherText(displayText);
        // Keep controlPhase on "encrypting" so DecryptedText stays on the
        // finished ciphertext without reshuffling via "encrypted".
        schedule(() => {
          setControlPhase("encrypted");
          setStage("database");
          schedule(() => {
            setStage("thread");
            schedule(() => setControlPhase("decrypting"), LAYOUT_SETTLE_MS);
          }, STORED_REST_MS);
        }, ENCRYPTED_HOLD_MS);
        return;
      }

      setFrozenCipherText("");
      setControlPhase("plain");
    },
    [schedule]
  );

  useEffect(() => clearTimers, [clearTimers]);

  const isEncryptedHold =
    controlPhase === "encrypting" && stage === "thread" && frozenCipherText.length > 0;
  const isEncrypting =
    controlPhase === "encrypting" && stage === "thread" && !isEncryptedHold;
  const isStored = stage === "database";

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex h-full min-h-[13rem] flex-col overflow-hidden p-4 sm:min-h-[15rem] sm:p-5",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,color-mix(in_oklch,var(--accent)_16%,transparent),transparent_55%),radial-gradient(circle_at_100%_100%,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,color-mix(in_oklch,var(--foreground)_6%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--foreground)_6%,transparent)_1px,transparent_1px)] [background-size:18px_18px]"
      />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <StatusPill active={!isStored} label="In transit" tone="muted" />
        <TlsPulse active={isEncrypting} motionActive={motionActive} reduced={reduce === true} />
        <StatusPill active={isStored} label="At rest" tone="accent" />
      </div>

      <LayoutGroup id="welcome-encryption-payload">
        <div
          className={cn(
            "relative z-10 mt-4 rounded-xl border border-border/50 p-3 sm:p-3.5",
            glass({ border: "none", opaque: true })
          )}
        >
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Thread message
          </p>
          <div className={cn("relative", TEXT_SLOT_CLASS)}>
            <p aria-hidden className="invisible">
              {MESSAGE}
            </p>
            <div className="absolute inset-0">
              {stage === "thread" ? (
                <motion.div
                  className="h-full w-full"
                  layout="position"
                  layoutId="welcome-enc-payload"
                  transition={LAYOUT_TRANSITION}
                >
                  {reduce ? (
                    <p className="font-mono text-foreground">{MESSAGE}</p>
                  ) : (
                    <DecryptedText
                      animateOn="controlled"
                      className="text-left font-mono text-foreground"
                      controlPhase={controlPhase}
                      encryptedClassName="text-left font-mono text-accent/85"
                      parentClassName="block w-full font-mono"
                      revealDirection="start"
                      sequential
                      speed={28}
                      text={MESSAGE}
                      onControlPhaseComplete={handleControlComplete}
                    />
                  )}
                </motion.div>
              ) : (
                <p className="text-[11px] text-muted-foreground/45 sm:text-xs">
                  Message encrypted — stored below
                </p>
              )}
            </div>
          </div>
        </div>

        <motion.div
          animate={motionActive ? { opacity: [0.35, 0.85, 0.35] } : undefined}
          aria-hidden
          className="relative z-10 mx-auto my-3 flex flex-col items-center gap-1 text-accent/70"
          transition={{ duration: 2.4, ease: "easeInOut", repeat: motionActive ? Infinity : 0 }}
        >
          <span className="h-5 w-px bg-linear-to-b from-transparent via-accent/50 to-accent/80" />
          <span className="text-[10px] uppercase tracking-[0.18em]">
            {isEncrypting && !isEncryptedHold
              ? "encrypting"
              : isEncryptedHold
                ? "encrypted"
                : "encrypt"}
          </span>
          <span className="h-5 w-px bg-linear-to-b from-accent/80 via-accent/50 to-transparent" />
        </motion.div>

        <div
          className={cn(
            "relative z-10 mt-auto overflow-hidden rounded-xl border p-3 sm:p-3.5",
            glass({ border: "none", opaque: true }),
            isStored
              ? "border-accent/35 bg-linear-to-br from-accent/10 via-transparent to-foreground/4"
              : "border-accent/20 bg-linear-to-br from-accent/5 via-transparent to-foreground/3"
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <motion.div
                animate={motionActive && isStored ? { scale: [1, 1.04, 1] } : undefined}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg border text-accent",
                  isStored
                    ? "border-accent/35 bg-accent/12"
                    : "border-accent/20 bg-accent/5"
                )}
                transition={{ duration: 3.5, ease: "easeInOut", repeat: motionActive && isStored ? Infinity : 0 }}
              >
                <Lock aria-hidden className="size-4" strokeWidth={1.75} />
              </motion.div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Database
                </p>
                <p className="text-xs text-foreground/90">Ciphertext at rest</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-1 text-[10px] font-medium tracking-wide text-accent">
              <ShieldCheck aria-hidden className="size-3" strokeWidth={2} />
              AES-256-GCM
            </span>
          </div>

          <div
            className={cn(
              "relative rounded-lg border border-dashed px-3 py-2.5",
              TEXT_SLOT_CLASS,
              isStored
                ? "border-accent/30 bg-background/50"
                : "border-border/50 bg-background/25"
            )}
          >
            <p aria-hidden className="invisible">
              {MESSAGE}
            </p>
            <div className="absolute inset-0 px-3 py-2.5">
              {stage === "database" ? (
                <motion.div
                  className="h-full w-full font-mono text-accent/80"
                  layout="position"
                  layoutId="welcome-enc-payload"
                  transition={LAYOUT_TRANSITION}
                >
                  {frozenCipherText}
                </motion.div>
              ) : (
                <p className="text-[11px] text-muted-foreground/45 sm:text-xs">
                  Waiting for ciphertext…
                </p>
              )}
            </div>
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}

function StatusPill({
  label,
  tone,
  active = false,
}: {
  label: string;
  tone: "muted" | "accent";
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors",
        tone === "accent"
          ? active
            ? "border-accent/35 bg-accent/12 text-accent"
            : "border-accent/20 bg-accent/5 text-accent/55"
          : active
            ? "border-border/60 bg-background/50 text-muted-foreground"
            : "border-border/40 bg-background/30 text-muted-foreground/50"
      )}
    >
      {label}
    </span>
  );
}

function TlsPulse({
  reduced,
  active,
  motionActive,
}: {
  reduced: boolean;
  active: boolean;
  motionActive: boolean;
}) {
  return (
    <div aria-hidden className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className={cn("h-px flex-1", active ? "bg-accent/35" : "bg-border/70")} />
      {reduced ? (
        <span
          className={cn(
            "size-1.5 rounded-full",
            active ? "bg-accent" : "bg-accent/50"
          )}
        />
      ) : (
        <motion.span
          animate={
            motionActive && active
              ? { opacity: [0.35, 1, 0.35], scale: [0.85, 1.15, 0.85] }
              : { opacity: 0.45 }
          }
          className={cn("size-1.5 rounded-full", active ? "bg-accent" : "bg-accent/45")}
          transition={
            motionActive && active
              ? { duration: 1.8, ease: "easeInOut", repeat: Infinity }
              : { duration: 0.3 }
          }
        />
      )}
      <span className={cn("h-px flex-1", active ? "bg-accent/35" : "bg-border/70")} />
    </div>
  );
}
