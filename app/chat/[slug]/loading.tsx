import { PropagateLoader } from "react-spinners";

import Page from "@/components/layout/page";

export default function ChatLoading() {
  return (
    <Page>
      <div className="flex flex-col items-center justify-center gap-10 -translate-y-10 p-10 min-h-screen h-screen box-border bg-background">
        <span className="mt-3 text-secondary-foreground text-xl">Loading chat…</span>
        <PropagateLoader color="#128C74" />
      </div>
    </Page>
  );
}
