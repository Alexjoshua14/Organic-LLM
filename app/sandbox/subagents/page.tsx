import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { OpenShellButton } from "./open-shell-button";

import { glass } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { PageContentFrame } from "@/components/layout/page-content-frame";
import { isAdminUser } from "@/lib/admin/read-admin-profile";
import { HARD_SET_SUBAGENTS } from "@/lib/llm/subagents/hard-set/registry";
import { cn } from "@/lib/utils";

/**
 * Subagent lab: every hard-set subagent, each with a way into a fresh shell thread where you talk
 * to it directly. Admin only. Adding subagents: `lib/llm/subagents/hard-set/README.md`.
 */
export default async function SubagentLabPage() {
  const { userId } = await auth();

  if (!userId || !(await isAdminUser(userId))) notFound();

  return (
    <Page className="items-stretch justify-start overflow-hidden">
      <div className="h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame maxWidth="4xl">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Subagent lab</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Hard-set subagents in development. Open a shell to talk to one directly. Asking for
              help gets its reflex menu; anything that needs thought runs as a normal turn.
            </p>
          </header>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {HARD_SET_SUBAGENTS.map((agent) => (
              <li
                key={agent.id}
                className={cn(
                  glass(),
                  "flex flex-col gap-3 rounded-2xl border border-border/70 p-5"
                )}
              >
                <div>
                  <h2 className="font-semibold tracking-tight">{agent.name}</h2>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {agent.role} · {agent.id}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{agent.blurb}</p>
                <div className="mt-auto">
                  <OpenShellButton agentId={agent.id} agentName={agent.name} />
                </div>
              </li>
            ))}
          </ul>
        </PageContentFrame>
      </div>
    </Page>
  );
}
