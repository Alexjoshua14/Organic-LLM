import type { Metadata } from "next";
import type { TaskWithCategory } from "@/lib/ergon/types";

import { auth } from "@clerk/nextjs/server";

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
    <Page className="items-stretch justify-start overflow-hidden" transparentBackground>
      <div
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col pb-4 md:pb-8",
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
