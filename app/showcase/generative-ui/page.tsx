import type { Metadata } from "next";

import { GenerativeUIStage } from "@/components/showcase/GenerativeUIStage";
import { ShowcaseDemoFrame } from "@/components/showcase/ShowcaseDemoFrame";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Generative UI"),
  description:
    "Explore an answer as a comparison, a step-by-step plan, and an interactive checklist. A public demo of Organic LLM’s production components.",
};

export default function GenerativeUIShowcasePage() {
  return (
    <ShowcaseDemoFrame
      slug="generative-ui"
      title="Generative UI"
      value="One request becomes a comparison, a plan, and a checklist you can use. Try all three formats."
    >
      <GenerativeUIStage />
    </ShowcaseDemoFrame>
  );
}
