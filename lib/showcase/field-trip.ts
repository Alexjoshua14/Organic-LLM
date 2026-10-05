import type { ShowcaseTourSlug } from "./feature-tour";

/**
 * The guided field trip on /showcase: one fictional project, told as five moments. Each
 * chapter frames the feature by what it did for the person at that moment; the full
 * demo page for each stays one click away.
 */
export type FieldTripChapter = {
  slug: ShowcaseTourSlug;
  /** Where we are in the trip. */
  when: string;
  /** Short label for the chapter bar. */
  label: string;
  headline: string;
  narration: string;
};

export const FIELD_TRIP_INTRO =
  "One project, five moments: your first night photographing the Milky Way.";

export const FIELD_TRIP: readonly FieldTripChapter[] = [
  {
    slug: "rabbit-holes",
    when: "Two weeks out",
    label: "Explore",
    headline: "It starts with a question.",
    narration:
      "What is the Milky Way's bright core, and when can you see it? Follow the question, and every branch stays on the map.",
  },
  {
    slug: "generative-ui",
    when: "That evening",
    label: "Shape",
    headline: "Turn research into a plan.",
    narration:
      "Ask for a place and get something you can use: sites compared, the night laid out, a kit list to check off.",
  },
  {
    slug: "voice",
    when: "On the night",
    label: "Converse",
    headline: "Keep your hands on the tripod.",
    narration: "Cold hands on the gear: ask for camera settings out loud, and read the answer too.",
  },
  {
    slug: "context-controls",
    when: "The next morning",
    label: "Inspect",
    headline: "See what it remembered.",
    narration:
      "Look at what the assistant was working from, then turn context effort up: more time, a wider search, more of what it knows.",
  },
  {
    slug: "models-and-usage",
    when: "End of the week",
    label: "Choose",
    headline: "The right model for the job.",
    narration:
      "A quick question and a full plan don't need the same model. Switch in the composer.",
  },
];
