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
 * Neutral smoke glass — blur + theme tint + hairline border. Uses HeroUI background/border
 * tokens (not raw white/black) so light/dark follow the app palette automatically.
 */
export const glass = tv({
  base: [
    "organic-glass-smoke",
    "backdrop-blur-[20px] backdrop-saturate-[1.12]",
    "bg-background/30",
    "border border-border/50",
  ].join(" "),
  variants: {
    tone: {
      default: "",
      brown:
        "backdrop-saturate-[1.18] bg-background-secondary/35 border-amber-900/15 dark:border-amber-200/10",
    },
    opaque: {
      true: "backdrop-blur-[16px] bg-background/78",
    },
    border: {
      all: "",
      right: "border-0 border-r border-border/50",
      left: "border-0 border-l border-border/50",
      none: "border-0",
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
 * Experimental "organic glass" working material: near-transparent fill, refraction-capable
 * backdrop-filter (requires `OrganicGlassRefractFilterSvg` in the tree), chromatic rim. No
 * inset specular or top-edge “rim light” — depth comes from shadow lift only. Lab column only.
 */
export const organicGlassWorking = tv({
  base: [
    "organic-glass relative isolate overflow-hidden",

    // Refraction (custom utility) + named blur/saturate — composes correctly in v4
    "backdrop-refract backdrop-blur-3xl backdrop-saturate-[1.8]",
    "dark:backdrop-saturate-[1.7]",

    // Depth without feigned top light: bottom inner pooling + outer lift only
    "shadow-[inset_0_-1px_0_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04),0_18px_48px_-22px_rgba(20,21,22,0.45)]",
    "dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.2),0_22px_60px_-24px_rgba(0,0,0,0.75)]",
  ].join(" "),
  variants: {
    tone: {
      default: "bg-white/[0.04] dark:bg-white/[0.025]",
      // Brown only adjusts fill + bumps saturation — backdrop-refract + blur from base still apply
      brown:
        "bg-amber-100/[0.06] dark:bg-amber-950/[0.10] backdrop-saturate-200 dark:backdrop-saturate-[1.85]",
    },
    opaque: {
      // Legibility-first: heavier fill, drop refraction (it fights text), keep blur
      true: "bg-background-tertiary/70 dark:bg-background-tertiary/65 [backdrop-filter:none] backdrop-blur-2xl backdrop-saturate-110",
    },
    depth: {
      flat: "shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.25)]",
      raised: "",
      floating: [
        "shadow-[inset_0_-1px_0_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.05),0_28px_72px_-26px_rgba(20,21,22,0.55)]",
        "dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.45),0_2px_4px_rgba(0,0,0,0.3),0_30px_84px_-28px_rgba(0,0,0,0.85)]",
      ].join(" "),
    },
    border: {
      // Chromatic rim — dispersion tint without a bright “key light” sweep
      all: [
        "after:pointer-events-none after:absolute after:inset-0 after:z-[2] after:rounded-[inherit] after:p-px after:content-['']",
        "after:bg-[linear-gradient(135deg,rgba(190,210,255,0.22)_0%,rgba(170,205,255,0.16)_28%,rgba(255,200,220,0.12)_72%,rgba(210,215,230,0.16)_100%)]",
        "after:[mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]",
        "after:[mask-composite:exclude] after:[-webkit-mask-composite:xor]",
      ].join(" "),
      right: "border-r border-white/15 dark:border-white/10",
      left: "border-l border-white/15 dark:border-white/10",
      none: "",
    },
    interactive: {
      true: [
        "motion-safe:transition-[transform,background-color,box-shadow] motion-safe:duration-200 motion-safe:ease-out",
        "motion-safe:hover:-translate-y-0.5",
        "motion-safe:focus-within:-translate-y-0.5",
        "motion-safe:active:translate-y-0 motion-safe:active:scale-[0.997]",
      ].join(" "),
    },
  },
  defaultVariants: {
    tone: "default",
    border: "all",
    depth: "floating",
    interactive: true,
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
