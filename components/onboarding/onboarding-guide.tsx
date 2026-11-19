"use client";

import { useRef } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { GuideShortcutsTab } from "./guide-shortcuts-tab";
import { GuideStartTab } from "./guide-start-tab";
import { GuideTipsTab } from "./guide-tips-tab";
import { useOnboarding, type GuideTab } from "./onboarding-context";

import { glass } from "@/components/design-system/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { cn } from "@/lib/utils";

const TABS: Array<{ value: GuideTab; label: string }> = [
  { value: "start", label: "Start here" },
  { value: "shortcuts", label: "Shortcuts" },
  { value: "tips", label: "Tips" },
];

function isGuideTab(value: string): value is GuideTab {
  return TABS.some((tab) => tab.value === value);
}

/**
 * The Guide: the one place for help. Opened from "?" in the control cluster and from the welcome
 * card; never opens on its own. One surface, one close control (the dialog's own).
 */
export function OnboardingGuide() {
  const { guideOpen, setGuideOpen, guideTab, setGuideTab } = useOnboarding();
  const openerRef = useRef<HTMLElement | null>(null);
  const handoffRef = useRef(false);

  function closeForHandoff() {
    handoffRef.current = true;
    setGuideOpen(false);
  }

  return (
    <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
      <DialogContent
        className={cn(
          glass({ opaque: true }),
          "flex max-h-[min(88dvh,46rem)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl",
          "ring-1 ring-white/50 ring-inset dark:ring-white/10",
          "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none",
          "shadow-[0_24px_80px_-24px_rgb(0_0_0/0.25)] dark:shadow-[0_24px_80px_-24px_rgb(0_0_0/0.55)]"
        )}
        closeClassName="organic-focus top-0.5 right-[2px] flex size-11 items-center justify-center bg-transparent focus:ring-0 focus:ring-offset-0 data-[state=open]:bg-transparent"
        overlayClassName="bg-black/25 dark:bg-black/60 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none"
        onOpenAutoFocus={() => {
          handoffRef.current = false;
          openerRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (handoffRef.current) return;

          const opener = openerRef.current;
          const target =
            opener?.isConnected && opener !== document.body
              ? opener
              : document.querySelector<HTMLElement>("[data-guide-trigger]");

          target?.focus({ preventScroll: true });
        }}
      >
        <DialogHeader className="shrink-0 gap-stack-xs space-y-0 px-5 pt-5 pb-stack-md pr-12 text-left sm:px-6 sm:pt-6">
          <DialogTitle className="font-commissioner text-xl font-light tracking-wide sm:text-2xl">
            Guide
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Reopen the Guide any time from the ? button.
          </DialogDescription>
        </DialogHeader>

        <TabsPrimitive.Root
          className="flex min-h-0 flex-1 flex-col"
          value={guideTab}
          onValueChange={(value) => {
            if (isGuideTab(value)) setGuideTab(value);
          }}
        >
          <TabsPrimitive.List
            aria-label="Guide sections"
            className="flex shrink-0 gap-inline-lg border-b border-border/40 px-5 sm:px-6"
          >
            {TABS.map((tab) => (
              <TabsPrimitive.Trigger
                key={tab.value}
                className={cn(
                  "organic-focus -mb-px min-h-11 cursor-pointer border-b-2 border-transparent px-0.5 text-sm text-muted-foreground transition-colors",
                  "hover:text-foreground data-[state=active]:border-foreground/70 data-[state=active]:text-foreground"
                )}
                value={tab.value}
              >
                {tab.label}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
            <TabsPrimitive.Content className="outline-none" value="start">
              <GuideStartTab onHandoff={closeForHandoff} />
            </TabsPrimitive.Content>
            <TabsPrimitive.Content className="outline-none" value="shortcuts">
              <GuideShortcutsTab />
            </TabsPrimitive.Content>
            <TabsPrimitive.Content className="outline-none" value="tips">
              <GuideTipsTab />
            </TabsPrimitive.Content>
          </div>
        </TabsPrimitive.Root>
      </DialogContent>
    </Dialog>
  );
}
