import type {
  DecisionMatrixBlock,
  PlanTimelineBlock,
  ShoppingListBlock,
} from "@/lib/schemas/gen-ui";

import { SHOWCASE_STORY } from "./showcase-story";

const { sites, gear, settings } = SHOWCASE_STORY;

/** Illustrative scores, not live travel advice. Rendered by the production gen-UI blocks. */
export const showcaseDecision = {
  type: "decision-matrix",
  version: 1,
  question: "Where should we go?",
  options: sites.map((site) => ({
    id: site.id,
    name: site.name,
    note: `About ${site.driveHours} hours from San Francisco`,
  })),
  criteria: [
    { id: "dark", label: "Dark skies", weight: 3 },
    { id: "drive", label: "Easy drive", weight: 2 },
  ],
  scores: {
    pinnacles: {
      dark: { value: 5, note: "Dark Sky Park" },
      drive: { value: 4, note: "Within your four-hour preference" },
    },
    lassen: { dark: { value: 5 }, drive: { value: 2, note: "Beyond your preferred drive time" } },
    "point-reyes": { dark: { value: 2 }, drive: { value: 5 } },
  },
  recommendation: {
    optionId: "pinnacles",
    rationale: "Dark skies, with a drive that fits your four-hour limit.",
  },
} satisfies DecisionMatrixBlock;

export const showcasePlan = {
  type: "plan-timeline",
  version: 1,
  title: "Your first night at Pinnacles",
  steps: [
    {
      id: "choose",
      label: "Choose a new-moon weekend",
      status: "done",
      note: "Check the moon, forecast, and park access before leaving.",
    },
    {
      id: "setup",
      label: "Set up before dark",
      status: "now",
      estimate: "30 minutes",
      note: `Tripod ready. ${settings.focus}.`,
    },
    {
      id: "expose",
      label: `Start at ${settings.shutter}`,
      status: "next",
      note: `${gear.focalLengthMm}mm lens, ${settings.aperture}, ${settings.iso}. Adjust after a test shot.`,
    },
    {
      id: "review",
      label: "Check the stars, then refine",
      status: "next",
      note: "Zoom in to check focus and trailing. Keep the RAW files.",
    },
  ],
} satisfies PlanTimelineBlock;

export const showcaseKit = {
  type: "shopping-list",
  version: 1,
  title: "Ready for the night",
  groups: [
    {
      category: "Camera kit",
      items: [
        { name: "Full-frame camera + 24mm lens", status: "have", checked: true },
        { name: "Tripod and charged batteries", status: "have", checked: false },
        { name: "Empty memory cards", status: "have", checked: false },
      ],
    },
    {
      category: "After dark",
      items: [
        { name: "Extra warm layer", status: "have", checked: false },
        { name: "Headlamp", status: "have", checked: false },
        { name: "Hand warmers", status: "need", checked: false },
      ],
    },
  ],
} satisfies ShoppingListBlock;
