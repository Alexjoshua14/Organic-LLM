"use client";

import { Switch as HeroSwitch, type SwitchProps as HeroSwitchProps } from "@heroui/switch";

import {
  organicSwitchSelectedColors,
  organicSwitchThumb,
  organicSwitchTrack,
} from "./switch-styles";

import { cn } from "@/lib/utils";

export type SwitchProps = Omit<HeroSwitchProps, "as">;

/** Organic's compact glass switch. Keeps HeroUI's controlled, form, and accessibility APIs. */
export function Switch({ color = "primary", classNames, ...props }: SwitchProps) {
  const slots: SwitchProps["classNames"] = {
    ...classNames,
    base: cn("min-h-11 min-w-11", classNames?.base),
    wrapper: cn(
      organicSwitchTrack,
      "px-0.5 motion-reduce:transition-none",
      organicSwitchSelectedColors[color],
      classNames?.wrapper
    ),
    thumb: cn(
      organicSwitchThumb,
      "group-data-[pressed=true]:w-4 group-data-[selected]:group-data-[pressed]:ml-3.5",
      classNames?.thumb
    ),
  };

  return <HeroSwitch<"input"> {...props} classNames={slots} color={color} size="sm" />;
}
