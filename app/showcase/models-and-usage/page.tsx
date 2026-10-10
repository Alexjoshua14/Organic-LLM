import type { Metadata } from "next";

import { ModelsAndUsageStage } from "@/components/showcase/models-and-usage/ModelsAndUsageStage";
import { ShowcaseDemoFrame } from "@/components/showcase/ShowcaseDemoFrame";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Model Selection"),
  description:
    "Pick the right model for each job in the composer and see what you are choosing. No sign-in and no live model calls.",
};

const VALUE = "Match the model to the job, and see what you are choosing before you send.";

export default function ModelsAndUsagePage() {
  return (
    <ShowcaseDemoFrame slug="models-and-usage" title="Model Selection" value={VALUE}>
      <ModelsAndUsageStage />
    </ShowcaseDemoFrame>
  );
}
