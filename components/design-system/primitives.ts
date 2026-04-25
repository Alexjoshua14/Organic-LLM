import { tv } from "tailwind-variants";

export const title = tv({
  base: "tracking-tight inline font-semibold",
  variants: {
    color: {
      violet: "from-[#FF1CF7] to-[#b249f8]",
      yellow: "from-[#FF705B] to-[#FFB457]",
      blue: "from-[#5EA2EF] to-[#0072F5]",
      cyan: "from-[#00b7fa] to-[#01cfea]",
      green: "from-[#6FEE8D] to-[#17c964]",
      pink: "from-[#FF72E1] to-[#F54C7A]",
      foreground: "dark:from-[#FFFFFF] dark:to-[#4B4B4B]",
    },
    size: {
      sm: "text-3xl lg:text-4xl",
      md: "text-[2.3rem] lg:text-5xl",
      lg: "text-4xl lg:text-6xl",
    },
    fullWidth: {
      true: "w-full block",
    },
  },
  defaultVariants: {
    size: "md",
  },
  compoundVariants: [
    {
      color: ["violet", "yellow", "blue", "cyan", "green", "pink", "foreground"],
      class: "bg-clip-text text-transparent bg-linear-to-b",
    },
  ],
});

export const subtitle = tv({
  base: "w-full md:w-1/2 my-2 text-lg lg:text-xl text-default-600 block max-w-full",
  variants: {
    fullWidth: {
      true: "w-full!",
    },
  },
  defaultVariants: {
    fullWidth: true,
  },
});

export const page = tv({
  base: "w-full h-full bg-primary text-primary rounded",
});

/**
 * Caption: small muted text for short descriptions under headings (e.g. settings sections).
 */
export const caption = tv({
  base: "text-xs text-muted-foreground font-light leading-snug",
});

/**
 * Frosted "glass" surface: returns Tailwind `className` tokens from tailwind-variants. Use with
 * `cn(glass({ … }), "rounded-xl …")` for radius, padding, and any extra borders.
 *
 * Base: translucent `background-tertiary`, `backdrop-blur-2xl`, light backdrop brighten — content
 * behind stays visible but softened.
 *
 * Options (all optional; defaults match `defaultVariants` below):
 * - `tone` — `"default"`: neutral glass only. `"brown"`: warm amber wash on background/border plus
 *   `backdrop-saturate-150` for a paper/editorial feel.
 * - `opaque` — `true`: raises fill to `bg-background-tertiary/75` (light and dark) for legible type
 *   over busy backgrounds; omit for the lighter standard glass.
 * - `border` — `"all"` (default): uniform hairline via `border-1`. `"right"` / `"left"`: single-edge
 *   border. `"none"`: skip built-in border utilities when you supply your own border classes.
 */
export const glass = tv({
  base: "bg-background-tertiary/30 dark:bg-background-tertiary/20 backdrop-brightness-110 dark:backdrop-brightness-200 backdrop-blur-2xl  border-foreground/5",
  variants: {
    tone: {
      default: "",
      brown:
        "bg-amber-950/10 dark:bg-amber-950/20 border-amber-900/10 dark:border-amber-200/10 backdrop-saturate-150",
    },
    opaque: {
      true: "bg-background-tertiary/75 dark:bg-background-tertiary/75",
    },
    border: {
      all: "border-1",
      right: "border-r-1",
      left: "border-l-1",
      none: "",
    },
  },
  defaultVariants: {
    tone: "default",
    border: "all",
  },
});

/**
 * Preview candidate for Organic LLM's next glass material.
 *
 * This intentionally keeps the same class-helper shape as `glass()` so the default primitive can
 * be swapped later without forcing every call site to become a component. The material is tuned as
 * a foreground lens for `AdaptiveLiquidChrome`: readable by default, responsive through cheap
 * transform/opacity/shadow changes, and never dependent on animating `backdrop-filter`.
 */
export const glassPreview = tv({
  base: [
    "organic-glass-preview relative isolate overflow-hidden",
    "bg-linear-to-br from-background/86 via-background/60 to-background-tertiary/42",
    "dark:from-background-secondary/82 dark:via-background/62 dark:to-background-tertiary/38",
    "backdrop-blur-xl backdrop-saturate-150 backdrop-brightness-110",
    "dark:backdrop-saturate-150 dark:backdrop-brightness-125",
    "ring-1 ring-inset ring-white/35 dark:ring-white/10",
    "shadow-[0_18px_60px_-32px_rgba(20,21,22,0.55),inset_0_1px_0_rgba(255,255,255,0.42)]",
    "dark:shadow-[0_20px_70px_-34px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.12)]",
  ].join(" "),
  variants: {
    tone: {
      default: "",
      brown:
        "from-amber-50/82 via-stone-50/58 to-amber-950/12 border-amber-950/12 ring-amber-100/50 dark:from-amber-950/38 dark:via-background/58 dark:to-stone-950/48 dark:border-amber-200/12 dark:ring-amber-100/12",
    },
    opaque: {
      true: [
        "from-background/95 via-background/88 to-background-tertiary/70",
        "dark:from-background-secondary/94 dark:via-background/88 dark:to-background-tertiary/66",
        "backdrop-blur-lg",
      ].join(" "),
    },
    border: {
      all: "border border-border/45 dark:border-white/10",
      right: "border-r border-border/45 dark:border-white/10",
      left: "border-l border-border/45 dark:border-white/10",
      none: "border-0",
    },
    depth: {
      flat: "shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]",
      raised: "",
      floating:
        "shadow-[0_26px_90px_-38px_rgba(20,21,22,0.72),0_8px_32px_-24px_rgba(18,140,116,0.45),inset_0_1px_0_rgba(255,255,255,0.48)] dark:shadow-[0_28px_100px_-36px_rgba(0,0,0,0.92),0_8px_36px_-28px_rgba(18,140,116,0.55),inset_0_1px_0_rgba(255,255,255,0.14)]",
    },
    interactive: {
      true: [
        "motion-safe:transition-[transform,box-shadow,background-color,border-color] motion-safe:duration-200 motion-safe:ease-out",
        "hover:-translate-y-0.5 hover:border-accent/25 hover:ring-accent/20",
        "focus-within:-translate-y-0.5 focus-within:border-accent/30 focus-within:ring-accent/25",
        "active:translate-y-0 active:scale-[0.997]",
      ].join(" "),
    },
  },
  defaultVariants: {
    tone: "default",
    border: "all",
    depth: "raised",
  },
});

/**
 * Secondary-interactive: for secondary yet clearly available actions
 * (e.g. copy-to-clipboard on code blocks). Gradient aligns with Organic LLM’s
 * warm neutrals and accent teal; use on buttons and small interactive controls.
 */
export const secondaryInteractive = tv({
  base: [
    "border border-border shadow-sm text-foreground",
    "bg-gradient-to-br from-secondary to-[#e8e6e1]",
    "dark:from-[#252625] dark:to-[#1e1f1e]",
    "hover:from-accent/15 hover:to-accent/5 hover:border-accent/30",
    "dark:hover:from-accent/20 dark:hover:to-accent/10 dark:hover:border-accent/40",
    "transition-all duration-200",
  ].join(" "),
});
