import { Settings2Icon } from "lucide-react";
import { FC } from "react";
import Link from "next/link";

import { ThemeSwitch } from "../shared/theme-switch";

import { cn } from "@/lib/utils";

type ControlClusterProps = {
  className?: string;
  classNames?: string[];
};

export const ControlCluster: FC<ControlClusterProps> = ({ className }) => {
  return (
    <div
      className={cn(
        `absolute top-0 sm:translate-y-4 right-0 w-28 h-14 flex items-center justify-center z-10`,
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
