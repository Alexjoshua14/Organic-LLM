import type { Metadata } from "next";

import { Stage } from "@/components/stage/stage";
import Page from "@/components/layout/page";

export const metadata: Metadata = {
  title: "Stage",
  description: "A space to think and make things with Organic.",
};

export default function StagePage() {
  return (
    <Page chrome="full-bleed" className="!gap-0 !items-stretch !justify-start">
      <Stage />
    </Page>
  );
}
