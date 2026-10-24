import type { Metadata } from "next";
import type { TaskWithCategory } from "@/lib/ergon/types";

import { auth } from "@clerk/nextjs/server";

import { ErgonPageBackground } from "@/components/ergon/ErgonPageBackground";
import { ErgonPageClient } from "@/components/ergon/ErgonPageClient";
import Page from "@/components/layout/page";
import { pageContentFrameInsets } from "@/components/layout/page-content-frame";
import { listCategories } from "@/data/supabase/task-categories";
import { listTasks } from "@/data/supabase/tasks";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Ergon"),
};

export default async function ErgonPage() {
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  const [initialTasks, initialCategories] = await Promise.all([listTasks(), listCategories()]);

  return (
    <Page
      className="items-stretch justify-start overflow-x-hidden overflow-hidden"
      transparentBackground
    >
      <ErgonPageBackground />
      <div
        className={cn(
          "relative z-10 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:pb-8",
          pageContentFrameInsets
        )}
      >
        <ErgonPageClient
          initialCategories={initialCategories}
          initialTasks={initialTasks as TaskWithCategory[]}
        />
      </div>
    </Page>
  );
}
