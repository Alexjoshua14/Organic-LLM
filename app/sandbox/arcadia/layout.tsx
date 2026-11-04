import type { ReactNode } from "react";

import { ArcadiaPersistentHost } from "./_components/multitask-host";

import Page from "@/components/layout/page";

/**
 * The multiagent board lives here, above `[slug]`, so switching to a subagent's thread swaps only
 * the thread. Each thread page tells the host about itself with `ArcadiaThreadMeta`.
 */
export default function ArcadiaLayout({ children }: { children: ReactNode }) {
  return (
    <Page>
      <ArcadiaPersistentHost>{children}</ArcadiaPersistentHost>
    </Page>
  );
}
