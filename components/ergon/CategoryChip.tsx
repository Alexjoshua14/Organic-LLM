import { cn } from "@/lib/utils";

type CategoryChipProps = {
  label: string;
  color?: string | null;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

export function CategoryChip({
  label,
  color,
  selected = false,
  onClick,
  className,
}: CategoryChipProps) {
  const accent = color ?? "var(--border)";

  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
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
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
      />
      {label}
    </button>
  );
}
