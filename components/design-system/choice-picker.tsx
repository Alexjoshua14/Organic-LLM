"use client";

import { ChevronDown } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/third-party/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ChoicePickerOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type ChoicePickerGroup = {
  label: string;
  options: readonly ChoicePickerOption[];
};

export type ChoicePickerProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
} & (
  | { options: readonly ChoicePickerOption[]; groups?: never }
  | { groups: readonly ChoicePickerGroup[]; options?: never }
);

/** Single-choice navigation, composed from Organic glass and the shared menu keyboard behavior. */
export function ChoicePicker({
  label,
  value,
  onValueChange,
  className,
  disabled,
  options,
  groups,
}: ChoicePickerProps) {
  const choices = groups?.flatMap((group) => group.options) ?? options ?? [];
  const selected = choices.find((option) => option.value === value);

  function renderOption(option: ChoicePickerOption) {
    return (
      <DropdownMenuRadioItem
        key={option.value}
        value={option.value}
        disabled={option.disabled}
        textValue={option.label}
        className={cn(
          "min-h-11 cursor-pointer items-start rounded-lg py-2.5 pl-8 pr-3 outline-none",
          "data-[state=checked]:bg-muted/60 data-[state=checked]:font-medium",
          "focus:bg-primary focus:text-primary-foreground data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground",
          "[&>span:first-child]:top-3.5 data-[disabled]:cursor-not-allowed"
        )}
      >
        <span className="min-w-0 space-y-0.5">
          <span className="block text-sm leading-5">{option.label}</span>
          {option.description ? (
            <span className="block text-xs font-normal leading-relaxed">{option.description}</span>
          ) : null}
        </span>
      </DropdownMenuRadioItem>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${selected?.label ?? "Choose"}`}
          disabled={disabled || choices.length === 0}
          className={cn(
            "group inline-flex min-h-11 min-w-0 max-w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-foreground outline-none",
            "hover:bg-muted/60 data-[state=open]:bg-muted/60 focus-visible:bg-primary focus-visible:text-primary-foreground",
            "disabled:cursor-not-allowed disabled:text-muted-foreground",
            className
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-2xs leading-4 text-muted-foreground group-focus-visible:text-primary-foreground">
              {label}
            </span>
            <span className="block truncate text-sm font-medium leading-5">
              {selected?.label ?? "Choose"}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        aria-label={label}
        className={cn(
          glass({ opaque: true }),
          "z-[230] w-80 max-w-[min(24rem,var(--radix-dropdown-menu-content-available-width))] min-w-0 rounded-2xl p-2 text-foreground shadow-lg outline-none",
          "max-h-[min(28rem,var(--radix-dropdown-menu-content-available-height))] overscroll-contain motion-reduce:animate-none"
        )}
      >
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange} aria-label={label}>
          {groups
            ? groups.map((group, index) => (
                <DropdownMenuGroup key={group.label}>
                  {index > 0 ? <DropdownMenuSeparator className="mx-2 my-2 bg-border/50" /> : null}
                  <DropdownMenuLabel className="px-3 pb-1 pt-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </DropdownMenuLabel>
                  {group.options.map(renderOption)}
                </DropdownMenuGroup>
              ))
            : options?.map(renderOption)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
