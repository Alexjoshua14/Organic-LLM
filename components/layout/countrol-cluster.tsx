"use client";

import { Settings2Icon } from "lucide-react";
import { FC, useState } from "react";

import { ThemeSwitch } from "../shared/theme-switch";
import { SettingsOverlay } from "../settings/SettingsOverlay";
import { GuideTrigger } from "../onboarding/guide-trigger";
import { UsageOverlay } from "../usage/usage-overlay";
import { glass } from "../design-system/primitives";
import { useSidebar } from "../third-party/ui/sidebar";

import { cn } from "@/lib/utils";

type ControlClusterProps = {
  className?: string;
  classNames?: string[];
};

export const ControlCluster: FC<ControlClusterProps> = ({ className }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { open } = useSidebar();

  return (
    <>
      <div
        className={cn(
          "control-cluster",
          `${glass()} absolute top-[env(safe-area-inset-top,0px)] ${open ? "md:translate-y-4" : ""} md:top-0 right-0 w-auto px-inset-sm h-14 flex items-center justify-center gap-inline-xs z-[215] rounded-bl-lg transition-all duration-200`,
          className
        )}
      >
        <GuideTrigger className="min-w-8 w-8 h-8" />
        <UsageOverlay triggerClassName="min-w-8 w-8 h-8" />
        <button
          aria-expanded={settingsOpen}
          aria-label={settingsOpen ? "Close quick settings" : "Open quick settings"}
          className="organic-focus organic-lumen-interactive group size-8 min-w-8 grid cursor-pointer place-content-center rounded-md border-0"
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Settings2Icon
            className="transition-transform duration-200 ease-out motion-safe:group-hover:scale-110 motion-safe:group-active:scale-95"
            size={16}
          />
        </button>
        <div className="grid h-8 w-8 place-content-center">
          <ThemeSwitch variant="compact" />
        </div>
      </div>
      <SettingsOverlay open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};
