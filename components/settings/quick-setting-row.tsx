"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Popover } from "radix-ui";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

// Give the pointer time to cross the gap between the label and its caption.
const CAPTION_CLOSE_GRACE_MS = 120;

type QuickSettingRowProps = {
  label: string;
  caption: string;
  icon?: ReactNode;
  children: ReactNode;
};

export function QuickSettingRow({ label, caption, icon, children }: QuickSettingRowProps) {
  const captionId = useId();
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const keyboardFocused = useRef(false);
  const pointerActivation = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function close() {
    cancelClose();
    pinned.current = false;
    keyboardFocused.current = false;
    setOpen(false);
  }

  function scheduleClose() {
    cancelClose();
    if (pinned.current || keyboardFocused.current) return;
    closeTimer.current = setTimeout(() => setOpen(false), CAPTION_CLOSE_GRACE_MS);
  }

  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    },
    []
  );

  return (
    <section className="flex min-h-11 items-center justify-between gap-3">
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
      >
        <h3 className="min-w-0 text-sm font-medium text-foreground">
          <Popover.Trigger asChild>
            <button
              aria-controls={open ? captionId : undefined}
              aria-describedby={open ? captionId : undefined}
              aria-label={`About ${label}`}
              className="flex min-h-11 items-center gap-2 rounded-sm text-left leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="button"
              onBlur={() => {
                keyboardFocused.current = false;
                pointerActivation.current = false;
                scheduleClose();
              }}
              onClick={(event) => {
                event.preventDefault();
                cancelClose();
                pointerActivation.current = false;
                pinned.current = !pinned.current;
                setOpen(pinned.current);
              }}
              onFocus={() => {
                if (pointerActivation.current) return;
                cancelClose();
                keyboardFocused.current = true;
                setOpen(true);
              }}
              onPointerDown={() => {
                pointerActivation.current = true;
              }}
              onPointerEnter={(event) => {
                if (event.pointerType === "touch") return;
                cancelClose();
                setOpen(true);
              }}
              onPointerLeave={scheduleClose}
            >
              {icon}
              {label}
            </button>
          </Popover.Trigger>
        </h3>
        <Popover.Portal>
          <Popover.Content
            align="start"
            aria-label={`About ${label}`}
            className={cn(
              glass({ opaque: true }),
              "z-[230] w-64 max-w-[var(--radix-popover-content-available-width)] rounded-lg px-3 py-2 text-xs leading-relaxed text-muted-foreground shadow-lg outline-none"
            )}
            collisionPadding={12}
            id={captionId}
            side="bottom"
            sideOffset={4}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          >
            {caption}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <div className="flex min-h-11 shrink-0 items-center">{children}</div>
    </section>
  );
}
