"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton() {
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
