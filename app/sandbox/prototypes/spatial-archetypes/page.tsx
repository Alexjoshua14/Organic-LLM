import { Suspense } from "react";
import type { Metadata } from "next";

import { SpatialArchetypesBrowser } from "./_components/SpatialArchetypesBrowser";

import { actionListSpatialArtifacts } from "@/app/actions/spatial-artifacts";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Spatial Archetypes"),
};

export default async function SpatialArchetypesPage() {
  const result = await actionListSpatialArtifacts({ coalescenceMode: true });

  return (
    <Suspense fallback={null}>
      <SpatialArchetypesBrowser
        initialArtifacts={result.artifacts}
        initialDisabled={result.disabled}
      />
    </Suspense>
  );
}
