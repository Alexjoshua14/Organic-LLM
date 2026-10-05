import type { Metadata } from "next";

import { ContextControlsStage } from "@/components/showcase/context-controls/ContextControlsStage";
import { ShowcaseDemoFrame } from "@/components/showcase/ShowcaseDemoFrame";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Context Controls"),
  description:
    "See what fills the next answer, then raise context effort and watch the memory budget grow. Scripted demo with synthetic context only.",
};

export default function ContextControlsShowcasePage() {
  return (
    <ShowcaseDemoFrame
      slug="context-controls"
      title="Context Controls"
      value="See what fills the next answer, then raise context effort and watch the memory budget grow."
    >
      <ContextControlsStage />
    </ShowcaseDemoFrame>
  );
}
