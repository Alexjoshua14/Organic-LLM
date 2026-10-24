import type { Metadata } from "next";

import { Suspense } from "react";

import { CoreInputLab } from "./_components/core-input-lab";

import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "CoreInput lab"),
};

export default function CoreInputLabPage() {
  // The lab reads `?view` / `?control` from the URL, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <CoreInputLab />
    </Suspense>
  );
}
