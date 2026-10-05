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
  "One project, five moments: planning your first night photographing the Milky Way. Scroll to follow it from a first question to a week of usage, with each feature working as it would in the app.";

export const FIELD_TRIP: readonly FieldTripChapter[] = [
  {
    slug: "rabbit-holes",
    when: "Two weeks out",
    label: "Explore",
    headline: "It starts with a question.",
    narration:
      "You want to photograph the Milky Way. What is its bright core, and when can you see it? Follow the question, then a better one, and every branch stays on the map.",
  },
  {
    slug: "generative-ui",
    when: "That evening",
    label: "Shape",
    headline: "Turn research into a plan.",
    narration:
      "Ask for a place and get something you can use: dark-sky sites compared, the weekend laid out, and a kit list to check off.",
  },
  {
    slug: "voice",
    when: "On the night",
    label: "Converse",
    headline: "Keep your hands on the tripod.",
    narration:
      "In the dark, with cold hands on the gear, you ask for camera settings out loud and get an answer you can also read.",
  },
  {
    slug: "context-controls",
    when: "The next morning",
    label: "Inspect",
    headline: "See what it remembered.",
    narration:
      "Before trusting the advice, look at what the assistant was working from. Turn memory effort up and watch more of what it knows about you come into view.",
  },
  {
    slug: "models-and-usage",
    when: "End of the week",
    label: "Choose",
    headline: "Choose the model. See the cost.",
    narration:
      "Quick questions and deep planning don't need the same model. Pick one for the job, then see what the week used and what it cost.",
  },
];
