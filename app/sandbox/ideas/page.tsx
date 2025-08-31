import { Divider } from "@heroui/divider";

import SubmitButton from "./submit-button";

import Page from "@/components/layout/page";
import { actionCreateIdea } from "@/app/actions/ideas";
import { listIdeas } from "@/data/supabase/ideas";

export default async function Home() {
  const ideas = await listIdeas();

  return (
    <Page>
      <h1 style={{ fontSize: "3rem" }}>Ideas</h1>

      <div className="w-full max-w-4xl flex flex-col" style={{ gap: 60 }}>
        <div className="w-full h-1/2 border-2 p-12 flex flex-col items-center gap-2">
          <h2 style={{ fontSize: "1.75rem" }}>Ideas List</h2>
          <Divider />
          <div className="flex flex-col gap-2 border-2 p-4 w-full">
            <h3 className="text-xl font-bold">Current Ideas:</h3>
            <Divider />
            {ideas.length > 0 &&
              ideas.map((idea: any) => (
                <div key={idea.id} className="p-2 border rounded">
                  <h4 className="font-semibold">{idea.title}</h4>
                  {idea.summary && (
                    <p className="text-sm text-gray-600">{idea.summary}</p>
                  )}
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>Priority: {idea.priority}</span>
                    <span>Status: {idea.status}</span>
                  </div>
                </div>
              ))}

            {ideas.length === 0 && <p>No ideas found</p>}
          </div>
        </div>
        <div className="w-full h-1/2 border-2 p-20 flex flex-col items-center gap-2">
          <h2 style={{ fontSize: "1.75rem" }}>Add New Idea</h2>
          <form
            action={actionCreateIdea}
            className={`flex flex-col gap-3 w-full max-w-md`}
          >
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
    </Page>
  );
}
