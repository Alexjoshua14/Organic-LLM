"use client";

import { Settings2Icon } from "lucide-react";
import { FC, useState } from "react";

import { ThemeSwitch } from "../shared/theme-switch";
import { SettingsOverlay } from "../settings/SettingsOverlay";
import { cn } from "@/lib/utils";
import { glass } from "../design-system/primitives";

type ControlClusterProps = {
  className?: string;
  classNames?: string[];
};

export const ControlCluster: FC<ControlClusterProps> = ({ className }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          `${glass()} absolute top-0 md:translate-y-4 right-0 w-24 h-14 flex items-center justify-center z-30 rounded-bl-lg`,
          className,
        )}
      >
        <button
          type="button"
          className="min-w-8 w-8 h-8 grid place-content-center border-0 hover:bg-background-tertiary rounded"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open quick settings"
        >
          <Settings2Icon size={16} />
        </button>
        <div className="w-8 h-8 grid place-content-center">
          <ThemeSwitch />
        </div>
      </div>
      <SettingsOverlay open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};
