import type { Metadata } from "next";

import { RabbitHoleToolFixtures } from "./_components/rabbit-hole-tool-fixtures";

import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Rabbit-hole tools"),
};

/** Every rabbit-hole tool result, rendered by the real chat component from stubbed payloads. */
export default function RabbitHoleToolsPrototypePage() {
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-xl px-4 py-stack-3xl">
        <RabbitHoleToolFixtures />
      </div>
    </main>
  );
}
