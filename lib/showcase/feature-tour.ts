/**
 * The feature demos read as one tour of one workspace: each page is a facet, and a single
 * fictional project (planning a first Milky Way shoot) threads through all of them so the
 * memory, research, plans, and voice turns visibly belong to the same person's work.
 */

export const SHOWCASE_VISION = "An AI workspace that remembers how you think.";

export const SHOWCASE_TOUR_INTRO =
  "Each demo shows one facet of Organic LLM, and they share a single project — planning a first night of Milky Way photography — so together they show one assistant following the same work from research to plan to a hands-free question in the field.";

export type ShowcaseTourSlug =
  | "rabbit-holes"
  | "generative-ui"
  | "voice"
  | "context-controls"
  | "models-and-usage";

export type ShowcaseTourStop = {
  slug: ShowcaseTourSlug;
  href: `/showcase/${ShowcaseTourSlug}`;
  title: string;
  /** One verb — the facet of the workspace this demo stands for. */
  facet: string;
  /** Where the shared project is when this demo picks it up. */
  moment: string;
  description: string;
};

export const SHOWCASE_TOUR: readonly ShowcaseTourStop[] = [
  {
    slug: "rabbit-holes",
    href: "/showcase/rabbit-holes",
    title: "Rabbit Holes",
    facet: "Explore",
    moment: "Learning what the Milky Way's core is and when it's visible",
    description:
      "Start from a topic, read the summary and key points, then branch into a related question — research that keeps every path visible.",
  },
  {
    slug: "generative-ui",
    href: "/showcase/generative-ui",
    title: "Generative UI",
    facet: "Shape",
    moment: "Turning the research into a plan",
    description:
      "One request becomes a decision matrix, a timeline, and a packing checklist you can use — structured answers instead of walls of text.",
  },
  {
    slug: "voice",
    href: "/showcase/voice",
    title: "Voice",
    facet: "Converse",
    moment: "Asking for camera settings in the dark, hands on the tripod",
    description:
      "A spoken exchange through the live voice bar — listening and speaking states, a readable transcript, and sound only if you turn it on.",
  },
  {
    slug: "context-controls",
    href: "/showcase/context-controls",
    title: "Context Controls",
    facet: "Inspect",
    moment: "Seeing what the assistant remembers before it answers",
    description:
      "Open the context window to see what fills it, then turn context effort up and watch the memory budget grow.",
  },
  {
    slug: "models-and-usage",
    href: "/showcase/models-and-usage",
    title: "Model Selection & Usage",
    facet: "Choose",
    moment: "Picking the right model and seeing what the week cost",
    description:
      "Pick a model in the composer, then read token usage, estimated cost, activity over time, and a per-model breakdown.",
  },
];

export function showcaseTourStop(slug: ShowcaseTourSlug): {
  stop: ShowcaseTourStop;
  index: number;
  previous: ShowcaseTourStop | null;
  next: ShowcaseTourStop | null;
} {
  const index = SHOWCASE_TOUR.findIndex((s) => s.slug === slug);

  if (index < 0) throw new Error(`Unknown showcase tour stop "${slug}"`);

  return {
    stop: SHOWCASE_TOUR[index]!,
    index,
    previous: SHOWCASE_TOUR[index - 1] ?? null,
    next: SHOWCASE_TOUR[index + 1] ?? null,
  };
}
