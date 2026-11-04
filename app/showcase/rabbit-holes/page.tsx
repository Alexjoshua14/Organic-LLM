import type { Metadata } from "next";

import { RabbitHolesShowcaseStage } from "@/components/showcase/rabbit-holes/RabbitHolesShowcaseStage";
import { ShowcaseDemoFrame } from "@/components/showcase/ShowcaseDemoFrame";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Rabbit Holes"),
  description:
    "Scripted replay of a rabbit hole on the Milky Way's core: the topic, a short summary, then a branch on seeing it from the Bay Area. Synthetic data only.",
};

export default function RabbitHolesShowcasePage() {
  return (
    <ShowcaseDemoFrame
      maxWidth="7xl"
      slug="rabbit-holes"
      title="Rabbit Holes"
      value="Start from a topic, read the summary and key points, then open a related question without losing the path."
    >
      <RabbitHolesShowcaseStage />
    </ShowcaseDemoFrame>
  );
}
