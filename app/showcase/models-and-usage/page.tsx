import type { Metadata } from "next";

import { ModelsAndUsageStage } from "@/components/showcase/models-and-usage/ModelsAndUsageStage";
import { ShowcaseDemoFrame } from "@/components/showcase/ShowcaseDemoFrame";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Model Selection & Usage"),
  description:
    "Choose a model in the composer, then inspect synthetic token usage, estimated cost, and a per-model breakdown. No sign-in and no live model calls.",
};

const VALUE =
  "Choose a model for the turn you're writing, then check tokens, estimated cost, and how the work split across models.";

export default function ModelsAndUsagePage() {
  return (
    <ShowcaseDemoFrame slug="models-and-usage" title="Model Selection & Usage" value={VALUE}>
      <ModelsAndUsageStage />
    </ShowcaseDemoFrame>
  );
}
