"use client";

import type { ChatStatus } from "ai";
import type { ComponentProps, FocusEvent, MouseEvent, PointerEvent } from "react";

import { useCallback, useState } from "react";

import { resolveSubmitGlyphState, SubmitGlyph } from "./submit-glyph";

import { InputGroupButton } from "@/components/third-party/ui/input-group";
import { cn } from "@/lib/utils";

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  stop?: () => void;
};

/**
 * Prototype-only "organic glass" treatment for the submit button. Applied by CoreInput when
 * `submitVariant="organic-glass"`; kept here so the submit's looks live with the submit.
 */
export const organicGlassSubmitClassName =
  "organic-glass-preview border border-white/20 bg-linear-to-br from-background/86 via-background/60 to-background-tertiary/42 text-foreground shadow-[0_10px_36px_-18px_rgba(20,21,22,0.65),inset_0_1px_0_rgba(255,255,255,0.38)] backdrop-blur-xl hover:border-accent/25 hover:text-foreground dark:border-white/10 dark:from-background-secondary/82 dark:via-background/62 dark:to-background-tertiary/38";

/**
 * The send button. Its default glyph morphs between the arrow, a spinning ring while a reply is
 * on its way, and a stop square when the user reaches for it.
 *
 * The square shows only where a click really stops (`stop` is passed), on mouse hover, keyboard
 * focus, or while a touch is held. Three guards keep it from showing at the wrong time:
 *
 * - Hover and focus are ignored from the moment a send starts until the pointer leaves or focus
 *   moves away. Otherwise the click that sent would leave the cursor over the button and the
 *   arrow-to-ring morph would never be seen.
 * - Only a mouse counts as hovering, so a touch can't leave a sticky hover behind.
 * - Only `:focus-visible` counts as focus, so clicking the button doesn't.
 */
export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  children,
  stop,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onFocus,
  onBlur,
  ...props
}: PromptInputSubmitProps) => {
  const busy = status === "submitted" || status === "streaming";
  const canStop = busy && Boolean(stop);
  const [hovering, setHovering] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  // False from the start of a send until the pointer leaves or focus moves away.
  const [armed, setArmed] = useState(true);
  const [wasBusy, setWasBusy] = useState(busy);

  if (busy !== wasBusy) {
    setWasBusy(busy);
    if (busy) setArmed(false);
  }

  const stopRequested = pressed || (armed && (hovering || focusVisible));
  const glyphState = resolveSubmitGlyphState({ status, canStop, stopRequested });

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (stop && (status === "streaming" || status === "submitted")) {
        e.preventDefault();
        stop();
      }
    },
    [stop, status]
  );

  return (
    <span className="inline-flex shrink-0 items-center">
      <InputGroupButton
        aria-label={canStop ? "Abort" : status === "ready" ? "Submit" : "Sending"}
        className={cn(className)}
        size={size}
        type={status === "ready" ? "submit" : "button"}
        variant={variant}
        {...props}
        onBlur={(event: FocusEvent<HTMLButtonElement>) => {
          setFocusVisible(false);
          setArmed(true);
          onBlur?.(event);
        }}
        onClick={handleClick}
        onFocus={(event: FocusEvent<HTMLButtonElement>) => {
          setFocusVisible(event.currentTarget.matches(":focus-visible"));
          onFocus?.(event);
        }}
        onPointerCancel={(event: PointerEvent<HTMLButtonElement>) => {
          setPressed(false);
          onPointerCancel?.(event);
        }}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
          setPressed(true);
          onPointerDown?.(event);
        }}
        onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
          if (event.pointerType === "mouse") setHovering(true);
          onPointerEnter?.(event);
        }}
        onPointerLeave={(event: PointerEvent<HTMLButtonElement>) => {
          setHovering(false);
          setPressed(false);
          setArmed(true);
          onPointerLeave?.(event);
        }}
        onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
          setPressed(false);
          onPointerUp?.(event);
        }}
      >
        {children ?? <SubmitGlyph state={glyphState} />}
      </InputGroupButton>
    </span>
  );
};
