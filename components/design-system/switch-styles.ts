import { glass } from "./primitives";

import { cn } from "@/lib/utils";

export const organicSwitchTrack = cn(glass(), "h-5 w-9 rounded-full bg-default-200/60");

export const organicSwitchThumb = cn(
  glass(),
  "size-3.5 rounded-full bg-white/85 shadow-small motion-reduce:transition-none"
);

export const organicSwitchSelectedColors = {
  default: "group-data-[selected=true]:bg-default-400/80",
  primary: "group-data-[selected=true]:bg-primary/80",
  secondary: "group-data-[selected=true]:bg-secondary/80",
  success: "group-data-[selected=true]:bg-success/80",
  warning: "group-data-[selected=true]:bg-warning/80",
  danger: "group-data-[selected=true]:bg-danger/80",
} as const;
