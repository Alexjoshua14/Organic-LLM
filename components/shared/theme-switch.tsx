"use client";

import { FC } from "react";
import { Sun, Moon, SunMoon } from "lucide-react";
import { useThrottledTheme } from "@/hooks/useThrottledTheme";
import { useIsSSR } from "@react-aria/ssr";
import clsx from "clsx";

export type ThemeOption = "system" | "light" | "dark";

const THEME_OPTIONS: { value: ThemeOption; label: string; Icon: FC<{ size?: number }> }[] = [
  { value: "system", label: "System", Icon: SunMoon },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

const CYCLE_ORDER: ThemeOption[] = ["system", "light", "dark"];

function nextTheme(current: ThemeOption): ThemeOption {
  const i = CYCLE_ORDER.indexOf(current);
  return CYCLE_ORDER[(i + 1) % CYCLE_ORDER.length];
}

export interface ThemeSwitchProps {
  className?: string;
  /** Show text labels next to icons (e.g. in settings). Default false for icon-only. */
  showLabels?: boolean;
  /** Single button that cycles system → light → dark. Use in tight layouts (e.g. header). */
  variant?: "segmented" | "compact";
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({
  className,
  showLabels = false,
  variant = "segmented",
}) => {
  const { theme, setTheme } = useThrottledTheme();
  const isSSR = useIsSSR();

  const current: ThemeOption = isSSR ? "system" : (theme === "light" || theme === "dark" ? theme : "system");
  const option = THEME_OPTIONS.find((o) => o.value === current)!;
  const { Icon } = option;

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => setTheme(nextTheme(current))}
        aria-label={`Theme: ${option.label}. Click to switch.`}
        title={`${option.label} (click to change)`}
        className={clsx(
          "flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors",
          "hover:bg-muted/60 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        <Icon size={20} />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={clsx(
        "inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5",
        className,
      )}
    >
      {THEME_OPTIONS.map(({ value, label, Icon: OptionIcon }) => {
        const isSelected = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={isSelected}
            aria-label={`${label} mode`}
            title={label}
            className={clsx(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground transition-colors",
              "hover:bg-muted/60 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isSelected && "bg-background text-foreground shadow-sm",
            )}
          >
            <OptionIcon size={showLabels ? 18 : 20} />
            {showLabels && (
              <span className="text-xs font-medium">{label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
