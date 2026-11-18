"use client";

import { composerLumenButtonClasses } from "@/components/chat/composer-action-button";
import {
  useComposerChipLumen,
  useComposerChipLumenHostRef,
} from "@/components/chat/use-composer-chip-lumen";
import {
  PromptInputSubmit,
  type PromptInputSubmitProps,
} from "@/components/chat/core-input/submit/submit-button";

/**
 * The send button on the composer's Lumen chip: the glass fill stays put on hover (no flash to the
 * ghost-variant background), and the rim peeks behind it the way it does for the other chips.
 * Same host / stage / backlight structure as `ComposerActionButton`; the rim is dark-mode only
 * there, so light mode gets that chip's muted hover instead.
 */
export function LumenSubmit({ className, ...props }: PromptInputSubmitProps) {
  const hostRef = useComposerChipLumenHostRef();

  useComposerChipLumen(hostRef);

  return (
    <span ref={hostRef} className="composer-tool-chip-host inline-flex shrink-0 overflow-visible">
      <span className="composer-tool-chip-stage relative inline-flex shrink-0">
        <span aria-hidden className="lumen-rim-backlight lumen-rim-backlight--hover" />
        <PromptInputSubmit className={composerLumenButtonClasses(true, className)} {...props} />
      </span>
    </span>
  );
}
