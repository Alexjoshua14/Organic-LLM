import { Divider } from "@heroui/divider";

import SubmitButton from "./submit-button";

import Page from "@/components/layout/page";
import { PageContentFrame } from "@/components/layout/page-content-frame";
import { actionCreateIdea } from "@/app/actions/ideas";
import { listIdeas } from "@/data/supabase/ideas";

export default async function Home() {
  const ideas = await listIdeas();

  return (
    <Page className="items-stretch justify-start overflow-hidden">
      <div className="h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame maxWidth="4xl">
          <h1 style={{ fontSize: "3rem" }}>Ideas</h1>

          <div className="flex w-full max-w-4xl flex-col" style={{ gap: 60 }}>
            <div className="flex h-1/2 w-full flex-col items-center gap-2 border-2 p-12">
              <h2 style={{ fontSize: "1.75rem" }}>Ideas List</h2>
              <Divider />
              <div className="flex w-full flex-col gap-2 border-2 p-4">
                <h3 className="text-xl font-bold">Current Ideas:</h3>
                <Divider />
                {ideas.length > 0 &&
                  ideas.map((idea: any) => (
                    <div key={idea.id} className="rounded border p-2">
                      <h4 className="font-semibold">{idea.title}</h4>
                      {idea.summary && <p className="text-sm text-gray-600">{idea.summary}</p>}
                      <div className="flex gap-2 text-xs text-gray-500">
                        <span>Priority: {idea.priority}</span>
                        <span>Status: {idea.status}</span>
                      </div>
                    </div>
                  ))}

                {ideas.length === 0 && <p>No ideas found</p>}
              </div>
            </div>
            <div className="flex h-1/2 w-full flex-col items-center gap-2 border-2 p-20">
              <h2 style={{ fontSize: "1.75rem" }}>Add New Idea</h2>
              <form action={actionCreateIdea} className="flex w-full max-w-md flex-col gap-3">
                <input
                  required
                  className="w-full rounded-lg border px-3 py-2"
                  maxLength={255}
                  minLength={2}
                  name="title"
                  placeholder="Idea title…"
                />

                <textarea
                  className="w-full rounded-lg border px-3 py-2"
                  name="summary"
                  placeholder="Brief summary"
                  rows={2}
                />

                <textarea
                  className="w-full rounded-lg border px-3 py-2"
                  name="notes"
                  placeholder="Detailed notes"
                  rows={3}
                />

                <div className="flex items-center gap-3">
                  <label className="text-sm opacity-70">
                    Priority:
                    <select
                      className="ml-2 rounded border px-2 py-1"
                      defaultValue="2"
                      name="priority"
                    >
                      <option value="1">High</option>
                      <option value="2">Medium</option>
                      <option value="3">Low</option>
                    </select>
                  </label>

                  <label className="text-sm opacity-70">
                    Status:
                    <select
                      className="ml-2 rounded border px-2 py-1"
                      defaultValue="open"
                      name="status"
                    >
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>

                  <div className="ml-auto">
                    <SubmitButton />
                  </div>
                </div>
              </form>
            </div>
          </div>
        </PageContentFrame>
      </div>
    </Page>
  );
}
