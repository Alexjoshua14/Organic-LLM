"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { MermaidDiagram } from "@/components/blog/mermaid-diagram";
import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import ShinyText from "@/components/ShinyText";
import { glass } from "@/components/design-system/primitives";
import { card, sectionLabel } from "@/lib/rabbit-holes/designTokens";
import {
  WELCOME_ARCADIA_MERMAID,
  WELCOME_ARCADIA_TOOL_NAME,
  WELCOME_ARCADIA_TOOL_STATUS,
  WELCOME_ARCADIA_USER_PROMPT,
} from "@/lib/welcome/arcadia-fixtures";
import { cn } from "@/lib/utils";

type WelcomeArcadiaIllustrationProps = {
  className?: string;
};

const PLANNING_MS = 450;

const ARIA_LABEL =
  "A user asks why an idea loses momentum; Arcadia renders a mind map of spark, scope, blur, friction, and drift.";

function UserPromptBubble({ text }: { text: string }) {
  return (
    <div className="mb-2 ml-auto w-fit max-w-[95%]">
      <div className={cn(glass(), "rounded-lg px-2.5 py-1.5 text-xs leading-snug text-foreground")}>
        {text}
      </div>
    </div>
  );
}

export function WelcomeArcadiaIllustration({ className }: WelcomeArcadiaIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [statusReady, setStatusReady] = useState(reduce);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const mountDiagram = inView && pageVisible;

  useEffect(() => {
    clearTimers();

    if (!mountDiagram || reduce) {
      setStatusReady(reduce);

      return;
    }

    setStatusReady(false);
    const id = setTimeout(() => setStatusReady(true), PLANNING_MS);

    timersRef.current.push(id);

    return clearTimers;
  }, [clearTimers, mountDiagram, reduce]);

  const frameClass = cn(
    "flex h-full min-h-0 flex-col justify-start px-2.5 py-3 sm:px-3 sm:py-4",
    className
  );

  const diagramClass =
    "flex w-full justify-center overflow-visible [&_.mermaid]:my-0 [&_.mermaid]:max-w-full [&_svg]:h-auto [&_svg]:max-w-full";

  return (
    <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
      <div className="mb-2 flex shrink-0 flex-col items-center gap-0.5 text-center">
        <p className={sectionLabel}>Arcadia tool</p>
        <span className="font-mono text-[10px] text-muted-foreground/75">
          {WELCOME_ARCADIA_TOOL_NAME}
        </span>
      </div>

      <div className={cn(card, "flex min-h-0 flex-1 flex-col rounded-lg p-2.5 sm:p-3")}>
        <UserPromptBubble text={WELCOME_ARCADIA_USER_PROMPT} />

        <div className="mb-2 flex min-h-[1.25rem] items-center gap-2">
          {statusReady ? (
            <span className="text-[10px] font-medium text-foreground/85">
              {WELCOME_ARCADIA_TOOL_STATUS.rendered}
            </span>
          ) : (
            <ShinyText
              as="span"
              className="text-[10px] font-light tracking-wide text-muted-foreground/80"
              speed={0.9}
              text={WELCOME_ARCADIA_TOOL_STATUS.planning}
            />
          )}
        </div>

        <div className="relative flex min-h-[11rem] flex-1 items-center justify-center overflow-visible sm:min-h-[12rem]">
          {mountDiagram ? (
            <div className={diagramClass}>
              <MermaidDiagram code={WELCOME_ARCADIA_MERMAID} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
