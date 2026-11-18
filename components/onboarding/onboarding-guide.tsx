"use client";

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

  return (
    <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
      <DialogContent
        className={cn(
          glass({ opaque: true }),
          "flex max-h-[min(88dvh,46rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl",
          "shadow-[0_24px_80px_-24px_rgb(0_0_0/0.25)] dark:shadow-[0_24px_80px_-24px_rgb(0_0_0/0.55)]"
        )}
        overlayClassName="bg-black/25 dark:bg-black/60"
      >
        <DialogHeader className="shrink-0 gap-stack-xs space-y-0 px-5 pt-5 pb-stack-md pr-12 text-left sm:px-6 sm:pt-6">
          <DialogTitle className="font-commissioner text-xl font-light tracking-wide sm:text-2xl">
            Guide
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            What Organic is, where everything lives, and how to move fast.
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
              <GuideStartTab />
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
