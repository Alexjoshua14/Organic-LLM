import { CompositionBlockSchema } from "./composition";

/** Synthetic examples for the Lab. Both compose the same scale with different supporting content. */
export const COMPOSITION_EXAMPLES = {
  population: CompositionBlockSchema.parse({
    type: "composition",
    version: 1,
    title: "Population share",
    nodes: [
      {
        kind: "scale",
        title: "Share of world population",
        unit: "%",
        domain: { min: 0, max: 100 },
        rows: [
          { label: "Rome, 117 CE", range: [20, 25], value: 22.5, tone: "action" },
          { label: "India", value: 17.8 },
          { label: "China", value: 17.5 },
        ],
      },
      {
        kind: "disclosure",
        label: "How to read the estimate",
        children: [
          {
            kind: "text",
            text: "Ancient population figures are estimates. The band represents a range, and the marker shows the midpoint.",
          },
          { kind: "source", label: "Example source", url: "https://example.com/population" },
        ],
      },
    ],
    fallback:
      "Estimate: Rome accounted for 20–25% of world population, with a midpoint of 22.5%. Illustrative figures for India and China are 17.8% and 17.5%.",
  }),
  release: CompositionBlockSchema.parse({
    type: "composition",
    version: 1,
    title: "Release readiness",
    nodes: [
      { kind: "heading", text: "Release plan" },
      {
        kind: "list",
        ordered: true,
        items: [
          { label: "Implement the layouts", status: "done" },
          { label: "Verify the mobile preview", status: "now" },
          { label: "Publish the gallery", status: "next" },
        ],
      },
      {
        kind: "scale",
        title: "Release checks",
        unit: "%",
        domain: { min: 0, max: 100 },
        rows: [
          { label: "Code review", value: 100 },
          { label: "Browser coverage", value: 75 },
        ],
      },
      {
        kind: "disclosure",
        label: "Show activity",
        children: [
          {
            kind: "list",
            ordered: true,
            items: [
              {
                label: "09:10 · Desktop review completed",
                detail: "Release agent verified the desktop layouts.",
              },
              {
                label: "09:25 · Mobile review queued",
                detail: "QA agent prepared the mobile review.",
              },
            ],
          },
        ],
      },
    ],
    fallback:
      "Code review is complete and browser coverage is at 75%. The team is verifying the mobile preview before publishing the gallery.",
  }),
} as const;
