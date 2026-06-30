import { cn } from "@/lib/utils";

type CategoryChipProps = {
  label: string;
  color?: string | null;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  size?: "default" | "sm";
};

export function CategoryChip({
  label,
  color,
  selected = false,
  onClick,
  className,
  size = "default",
}: CategoryChipProps) {
  const accent = color ?? "var(--border)";

  return (
    <button
      className={cn(
        "inline-flex items-center rounded-full border font-medium transition-colors select-none",
        size === "sm" ? "gap-1 px-2 py-0.5 text-[11px]" : "gap-1.5 px-2.5 py-1 text-xs",
        selected
          ? "border-[color:var(--chip-accent)] bg-[color:var(--chip-accent)/0.12] text-foreground"
          : "border-border/50 text-muted-foreground hover:text-foreground",
        onClick && "cursor-pointer",
        className
      )}
      style={{ ["--chip-accent" as string]: accent }}
      type={onClick ? "button" : "button"}
      onClick={onClick}
    >
      <span
        aria-hidden
        className={cn("shrink-0 rounded-full", size === "sm" ? "size-1.5" : "size-2")}
        style={{ backgroundColor: accent }}
      />
      {label}
    </button>
  );
}
