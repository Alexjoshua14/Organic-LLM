"use client";

import { actionCreateTask } from "@/app/actions/tasks";
import Page from "@/components/page";
import * as React from "react";
import { useFormStatus } from "react-dom";

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

export default function TaskQuickAdd() {
  return (
    <Page>
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
    </Page>
  );
}
