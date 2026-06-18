"use client";

import { Settings2Icon } from "lucide-react";
import { FC, useState } from "react";

import { ThemeSwitch } from "../shared/theme-switch";
import { SettingsOverlay } from "../settings/SettingsOverlay";
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
          `${glass()} absolute top-[env(safe-area-inset-top,0px)] ${open ? "md:translate-y-4" : ""} md:top-0 right-0 w-24 h-14 flex items-center justify-center z-30 rounded-bl-lg transition-all duration-200`,
          className
        )}
      >
        <button
          aria-label="Open quick settings"
          className="min-w-8 w-8 h-8 grid place-content-center border-0 hover:bg-background-tertiary rounded"
          type="button"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2Icon size={16} />
        </button>
        <div className="w-8 h-8 grid place-content-center">
          <ThemeSwitch variant="compact" />
        </div>
      </div>
      <SettingsOverlay open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};
