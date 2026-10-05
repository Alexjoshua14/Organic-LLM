import type { ShowcaseTourSlug } from "./feature-tour";

/** Visitor-facing framing shared by the overview and the individual demos. */
export const FEATURE_PRESENTATIONS: Record<
  ShowcaseTourSlug,
  {
    summary: string;
    headline: string;
    description: string;
    tryThis: string;
    detail: string;
  }
> = {
  "rabbit-holes": {
    summary: "Follow a question anywhere",
    headline: "Curiosity has more than one path.",
    description:
      "Explore a topic, follow a related question, and return to any point in your research.",
    tryThis: "Choose a related question, then return to the first topic using the path.",
    detail:
      "Each branch keeps its own article and context. The path makes the relationship between questions visible.",
  },
  "generative-ui": {
    summary: "Answers become useful interfaces",
    headline: "An answer you can work with.",
    description:
      "Compare places. Follow a plan. Check off your kit. The response takes the shape the task needs.",
    tryThis: "Switch from the comparison to the plan, then check an item off the kit list.",
    detail:
      "Structured model output renders through the same typed, interactive components used in chat.",
  },
  voice: {
    summary: "Keep the conversation going",
    headline: "Keep your hands on the tripod.",
    description: "Ask a question out loud and follow the response in a readable transcript.",
    tryThis: "Watch the listening and speaking states. Waveform sound is optional and synthetic.",
    detail:
      "The app uses a persistent Realtime voice session. This demo previews the interface without opening your microphone.",
  },
  "context-controls": {
    summary: "See what shapes the answer",
    headline: "You can see what it remembers.",
    description:
      "Inspect the context behind a response. Adjust memory effort and see exactly what changes.",
    tryThis:
      "Move context effort between Instant, Quick, and Heavy. Watch the memory list and budget respond.",
    detail:
      "The context inspector separates the system prompt, messages, tools, and memories inside the model’s input window.",
  },
  "models-and-usage": {
    summary: "Choose the model. See the cost.",
    headline: "Your models. Your call.",
    description:
      "Choose a model for the task, then see tokens, estimated cost, and usage over time.",
    tryThis: "Choose a different model, then switch the usage period to compare the sample totals.",
    detail:
      "The composer and usage views are real product components. Usage and costs here are explicitly sample data.",
  },
};
