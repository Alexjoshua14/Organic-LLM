/**
 * User-selectable font options for the app.
 * - featured: shown by default in the font picker (curated + "used by X" apps).
 * - All other fonts appear when the user searches.
 */

export type FontOption = {
  id: string;
  label: string;
  /** Google Fonts family name for loading (e.g. "DM Sans"). "system" uses system-ui. */
  googleId: string | null;
  /** Optional tag shown in UI, e.g. "Used by Linear, Vercel" */
  tag?: string;
  featured: boolean;
};

/** Fonts we bundle (next/font); id must match so we don't load from Google. */
export const BUNDLED_FONT_IDS = ["satoshi", "inter", "commissioner"] as const;

/** Default font when user has not set a preference. */
export const DEFAULT_FONT_ID = "satoshi";

const allFonts: FontOption[] = [
  // ——— Featured: curated + leading apps ———
  {
    id: "satoshi",
    label: "Satoshi",
    googleId: null,
    tag: "Default",
    featured: true,
  },
  {
    id: "inter",
    label: "Inter",
    googleId: null,
    tag: "Used by Linear, Figma, Notion",
    featured: true,
  },
  {
    id: "geist",
    label: "Geist",
    googleId: null,
    tag: "Used by Vercel",
    featured: true,
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    googleId: "DM Sans",
    tag: "Clean & modern",
    featured: true,
  },
  {
    id: "plus-jakarta-sans",
    label: "Plus Jakarta Sans",
    googleId: "Plus Jakarta Sans",
    tag: "Friendly & professional",
    featured: true,
  },
  {
    id: "source-sans-3",
    label: "Source Sans 3",
    googleId: "Source Sans 3",
    tag: "Used by Adobe",
    featured: true,
  },
  {
    id: "manrope",
    label: "Manrope",
    googleId: "Manrope",
    tag: "Geometric & readable",
    featured: true,
  },
  {
    id: "outfit",
    label: "Outfit",
    googleId: "Outfit",
    tag: "Contemporary",
    featured: true,
  },
  {
    id: "commissioner",
    label: "Commissioner",
    googleId: null,
    tag: "Headings in this app",
    featured: true,
  },
  {
    id: "system",
    label: "System",
    googleId: null,
    tag: "Your device’s default",
    featured: true,
  },
  // ——— Rest: available via search ———
  { id: "lato", label: "Lato", googleId: "Lato", featured: false },
  { id: "nunito", label: "Nunito", googleId: "Nunito", featured: false },
  {
    id: "open-sans",
    label: "Open Sans",
    googleId: "Open Sans",
    featured: false,
  },
  { id: "roboto", label: "Roboto", googleId: "Roboto", featured: false },
  { id: "poppins", label: "Poppins", googleId: "Poppins", featured: false },
  {
    id: "work-sans",
    label: "Work Sans",
    googleId: "Work Sans",
    featured: false,
  },
  { id: "rubik", label: "Rubik", googleId: "Rubik", featured: false },
  {
    id: "quicksand",
    label: "Quicksand",
    googleId: "Quicksand",
    featured: false,
  },
  { id: "raleway", label: "Raleway", googleId: "Raleway", featured: false },
  { id: "mulish", label: "Mulish", googleId: "Mulish", featured: false },
  { id: "lexend", label: "Lexend", googleId: "Lexend", featured: false },
  {
    id: "atkinson-hyperlegible",
    label: "Atkinson Hyperlegible",
    googleId: "Atkinson Hyperlegible",
    featured: false,
  },
  {
    id: "ibm-plex-sans",
    label: "IBM Plex Sans",
    googleId: "IBM Plex Sans",
    featured: false,
  },
  { id: "urbanist", label: "Urbanist", googleId: "Urbanist", featured: false },
  { id: "figtree", label: "Figtree", googleId: "Figtree", featured: false },
  { id: "sora", label: "Sora", googleId: "Sora", featured: false },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    googleId: "Space Grotesk",
    featured: false,
  },
  { id: "syne", label: "Syne", googleId: "Syne", featured: false },
  {
    id: "general-sans",
    label: "General Sans",
    googleId: "General Sans",
    featured: false,
  },
  {
    id: "cabinet-grotesk",
    label: "Cabinet Grotesk",
    googleId: "Cabinet Grotesk",
    featured: false,
  },
  {
    id: "instrument-sans",
    label: "Instrument Sans",
    googleId: "Instrument Sans",
    featured: false,
  },
  { id: "switzer", label: "Switzer", googleId: "Switzer", featured: false },
  {
    id: "satoshi-google",
    label: "Satoshi (Google)",
    googleId: "Satoshi",
    featured: false,
  },
  {
    id: "bricolage-grotesque",
    label: "Bricolage Grotesque",
    googleId: "Bricolage Grotesque",
    featured: false,
  },
  { id: "archivo", label: "Archivo", googleId: "Archivo", featured: false },
  { id: "karla", label: "Karla", googleId: "Karla", featured: false },
  {
    id: "red-hat-display",
    label: "Red Hat Display",
    googleId: "Red Hat Display",
    featured: false,
  },
  {
    id: "fira-sans",
    label: "Fira Sans",
    googleId: "Fira Sans",
    featured: false,
  },
  {
    id: "albert-sans",
    label: "Albert Sans",
    googleId: "Albert Sans",
    featured: false,
  },
  {
    id: "spline-sans",
    label: "Spline Sans",
    googleId: "Spline Sans",
    featured: false,
  },
];

export const featuredFonts = allFonts.filter((f) => f.featured);
export const allFontOptions = allFonts;

export function getFontById(id: string): FontOption | undefined {
  return allFonts.find((f) => f.id === id);
}
