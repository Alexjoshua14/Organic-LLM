/** Target screenshot ratios for welcome placeholder slots (see public/welcome/ASSETS.md). */
export const welcomeLandscapeRatio = 16 / 10;

export const welcomeVisualAspect = {
  /** Technical highlights — 1440×900 landscape */
  highlight: welcomeLandscapeRatio,
  /** Features bento — 1440×900 landscape */
  feature: welcomeLandscapeRatio,
} as const;

export type WelcomeVisualAspectKey = keyof typeof welcomeVisualAspect;

/** Max width caps — ratio is preserved; height scales down with width. */
export const welcomeVisualMaxWidth = {
  /** ~288×180 at 16:10 in highlight rows */
  highlight: "w-full max-w-[18rem] sm:max-w-[20rem]",
  /** ~176×110 at 16:10 in features bento */
  feature: "w-full max-w-[11rem] sm:max-w-[12.5rem]",
  /** Full column width in chat mode grid */
  mode: "w-full max-w-none",
} as const;

export type WelcomeVisualSizeKey = keyof typeof welcomeVisualMaxWidth;
