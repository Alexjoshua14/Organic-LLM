"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { actionCreateTask } from "@/app/actions/tasks";
import Page from "@/components/layout/page";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className="rounded-lg px-4 py-2 bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black"
      disabled={pending}
      type="submit"
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
          required
          className="w-full rounded-lg border px-3 py-2"
          maxLength={140}
          minLength={2}
          name="title"
          placeholder="Quick task…"
        />

        <textarea
          className="w-full rounded-lg border px-3 py-2"
          name="notes"
          placeholder="Optional notes"
          rows={3}
        />

        <div className="flex items-center gap-3">
          <label className="text-sm opacity-70">
            Priority:
            <select className="ml-2 rounded border px-2 py-1" defaultValue="medium" name="priority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>

          <label className="text-sm opacity-70">
            Due:
            <input
              className="ml-2 rounded border px-2 py-1"
              name="due_date"
              type="datetime-local"
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
