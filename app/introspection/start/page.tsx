import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import IntrospectionStartClient from "./start-client";

import Page from "@/components/layout/page";

export default async function IntrospectionStartPage() {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  return (
    <Page chrome="full-bleed">
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <Loader2 className="text-muted-foreground size-8 animate-spin" />
            <p className="text-muted-foreground text-sm">Loading…</p>
          </div>
        }
      >
        <IntrospectionStartClient />
      </Suspense>
    </Page>
  );
}
