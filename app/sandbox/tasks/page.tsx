"use client";
import { useEffect, useState } from "react";
import { useSession, useUser } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import Page from "@/components/page";
import { actionCreateTask } from "@/app/actions/tasks";
import { useFormStatus } from "react-dom";
import { Divider } from "@heroui/divider";

export default function Home() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  // The `useUser()` hook is used to ensure that Clerk has loaded data about the signed in user
  const { user } = useUser();
  // The `useSession()` hook is used to get the Clerk session object
  // The session object is used to get the Clerk session token
  const { session } = useSession();

  // Create a custom Supabase client that injects the Clerk session token into the request headers
  function createClerkSupabaseClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        async accessToken() {
          return session?.getToken() ?? null;
        },
      },
    );
  }

  // Create a `client` object for accessing Supabase data using the Clerk token
  const client = createClerkSupabaseClient();

  // This `useEffect` will wait for the User object to be loaded before requesting
  // the tasks for the signed in user
  useEffect(() => {
    if (!user) return;

    async function loadTasks() {
      setLoading(true);
      const { data, error } = await client.from("tasks").select();
      console.log(
        `Data: ${JSON.stringify(data)}\nError: ${JSON.stringify(error)}`,
      );
      if (!error) setTasks(data);
      setLoading(false);
    }

    loadTasks();
  }, [user]);

  async function createTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Insert task into the "tasks" database
    await client.from("tasks").insert({
      title: name,
    });
    window.location.reload();
  }

  return (
    <Page>
      <h1 style={{ fontSize: "3rem" }}>Tasks</h1>

      <div className="w-full max-w-4xl flex flex-col" style={{ gap: 60 }}>
        <div className="w-full h-1/2 border-2 p-12 flex flex-col items-center gap-2">
          <h2 style={{ fontSize: "1.75rem" }}>Client side</h2>
          {loading && <p>Loading...</p>}
          <Divider />
          <div className="flex flex-col gap-2 border-2 p-4">
            <h3 className="text-xl font-bold">Task list:</h3>
            <Divider />
            {!loading &&
              tasks.length > 0 &&
              tasks.map((task: any) => <p key={task.id}>{task.title}</p>)}

            {!loading && tasks.length === 0 && <p>No tasks found</p>}
          </div>
          <form onSubmit={createTask}>
            <input
              autoFocus
              type="text"
              name="name"
              placeholder="Enter new task"
              onChange={(e) => setName(e.target.value)}
              value={name}
            />
            <button type="submit">Add</button>
          </form>
        </div>
        <div className="w-full h-1/2 border-2 p-20 flex flex-col items-center gap-2">
          <h2 style={{ fontSize: "1.75rem" }}>Server Action</h2>
          <form action={actionCreateTask} className={`flex flex-col gap-3`}>
            <input
              name="title"
              placeholder="Quick task…"
              required
              minLength={2}
              maxLength={140}
              className="w-full rounded-lg border px-3 py-2"
            />

            <textarea
              name="notes"
              placeholder="Optional notes"
              className="w-full rounded-lg border px-3 py-2"
              rows={3}
            />

            <div className="flex items-center gap-3">
              <label className="text-sm opacity-70">
                Priority:
                <select
                  name="priority"
                  defaultValue="2"
                  className="ml-2 rounded border px-2 py-1"
                >
                  <option value="1">High</option>
                  <option value="2">Medium</option>
                  <option value="3">Low</option>
                </select>
              </label>

              <label className="text-sm opacity-70">
                Due:
                <input
                  type="datetime-local"
                  name="due_date"
                  className="ml-2 rounded border px-2 py-1"
                />
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg px-4 py-2 bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black"
      aria-busy={pending}
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}
