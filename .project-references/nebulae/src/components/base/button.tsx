import * as React from "react";
import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ButtonProps extends Omit<React.ComponentProps<typeof ShadcnButton>, "variant" | "size"> {
  /**
   * Nebulae button variant
   * - `primary`: Nebula accent color with shadow
   * - `secondary`: Outline style with subtle background
   * - `destructive`: Destructive action styling (red/destructive color)
   * - `inset`: Smooth metal button with recessed/embedded appearance
   */
  variant?: "primary" | "secondary" | "destructive" | "inset";
  /**
   * Button size
   * - `default`: Standard size with comfortable padding
   * - `sm`: Smaller size
   * - `lg`: Larger size with more padding
   * - `icon`: Icon-only button, square with equal padding
   */
  size?: "default" | "sm" | "lg" | "icon";
}

const variantStyles = {
  primary:
    "rounded-md bg-accent-nebula hover:bg-[oklch(0.65_0.18_270)] text-white shadow-lg shadow-accent-nebula/20 dark:shadow-accent-nebula/10 transition-all duration-300 cursor-pointer",
  secondary: "rounded-md cursor-pointer",
  destructive: "rounded-md cursor-pointer",
  inset: cn(
    "rounded-md",
    "cursor-pointer",
    "bg-gradient-to-b",
    "from-neutral-200/80",
    "to-neutral-300/60",
    "dark:from-neutral-700/60",
    "dark:to-neutral-800/80",
    "border",
    "border-neutral-300/50",
    "dark:border-neutral-600/50",
    "shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)]",
    "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]",
    "text-neutral-800",
    "dark:text-neutral-200",
    "hover:bg-gradient-to-b",
    "hover:from-neutral-200/80",
    "hover:to-neutral-300/60",
    "dark:hover:from-neutral-700/60",
    "dark:hover:to-neutral-800/80",
    "active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]",
    "dark:active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03)]",
    "transition-all",
    "duration-200"
  ),
};

const sizeStyles = {
  default: "px-12! h-10 py-3",
  sm: "px-8! h-8 py-2 text-sm",
  lg: "px-16! h-12 py-4 text-base",
  icon: "h-10 w-10 p-0 aspect-square flex items-center justify-center",
};

/**
 * Nebulae Button
 * 
 * A styled button component that wraps shadcn/ui Button with Nebulae's design system.
 * Provides primary and secondary variants with consistent spacing and styling.
 */
export function Button({
  variant = "primary",
  size = "default",
  className,
  ...props
}: ButtonProps) {
  // Map Nebulae variants to shadcn variants
  const shadcnVariant =
    variant === "primary"
      ? undefined // Uses default
      : variant === "destructive"
        ? "destructive"
        : variant === "inset"
          ? undefined // Inset uses custom styling, no shadcn variant
          : "outline"; // secondary

  return (
    <ShadcnButton
      size={undefined}
      variant={shadcnVariant}
      className={cn(
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  );
}

