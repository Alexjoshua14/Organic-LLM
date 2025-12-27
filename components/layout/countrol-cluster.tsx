import { Settings2Icon } from "lucide-react";
import { FC } from "react";
import Link from "next/link";

import { ThemeSwitch } from "../shared/theme-switch";

import { cn } from "@/lib/utils";
import { glass } from "../design-system/primitives";

type ControlClusterProps = {
  className?: string;
  classNames?: string[];
};

export const ControlCluster: FC<ControlClusterProps> = ({ className }) => {
  return (
    <div
      className={cn(
        `${glass()} absolute top-0 md:translate-y-4 right-0 w-24 h-14 flex items-center justify-center z-30 rounded-bl-lg`,
        className,
      )}
    >
      <Link
        className="min-w-8 w-8 h-8 grid place-content-center border-0 hover:bg-background-tertiary rounded"
        href="/settings"
      >
        <Settings2Icon size={16} />
      </Link>
      <div className="w-8 h-8 grid place-content-center">
        <ThemeSwitch />
      </div>
    </div>
  );
};
