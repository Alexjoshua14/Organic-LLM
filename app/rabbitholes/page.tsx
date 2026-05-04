import type { Metadata } from "next";

import { Suspense } from "react";
import { RabbitHoleShell } from "@/components/rabbit-holes/RabbitHoleShell";

import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Rabbit hole"),
};

export default function RabbitHolesPage() {
  return (
    <Suspense
      fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}
    >
      <RabbitHoleShell />
    </Suspense>
  );
}
