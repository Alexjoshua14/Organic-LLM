"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import type { TaskCategoryRow } from "@/lib/ergon/types";
import { isMultiLinePaste, parsePastedTaskTitles } from "@/lib/ergon/parse-paste";
import { refineQuickAddCaptures } from "@/lib/ergon/refine-quick-add-client";
import type { TaskInsert } from "@/lib/schemas/tasks";
import { cn } from "@/lib/utils";

type TaskQuickAddProps = {
  categories: Pick<TaskCategoryRow, "id" | "name">[];
  onAdd: (input: TaskInsert) => void | Promise<void>;
  onAddMany: (inputs: TaskInsert[]) => void | Promise<void>;
  onOpenFullEditor: () => void;
  className?: string;
};

export function TaskQuickAdd({
  categories,
  onAdd,
  onAddMany,
  onOpenFullEditor,
  className,
}: TaskQuickAddProps) {
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (raw?: string) => {
    const trimmed = (raw ?? title).trim();

    if (trimmed.length < 2 || pending) return;

    setPending(true);

    try {
      const [refined] = await refineQuickAddCaptures([trimmed], categories);

      await onAdd(refined ?? { title: trimmed, tags: [] });
      setTitle("");
    } finally {
      setPending(false);
    }
  };

  const submitMany = async (text: string) => {
    const titles = parsePastedTaskTitles(text);

    if (titles.length === 0 || pending) return;

    setPending(true);

    try {
      const refined = await refineQuickAddCaptures(titles, categories);

      if (refined.length === 1) {
        await onAdd(refined[0]!);
      } else {
        await onAddMany(refined);
        toast.success(`Added ${refined.length} tasks`);
      }

      setTitle("");
    } finally {
      setPending(false);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text/plain");

    if (!isMultiLinePaste(text)) {
      const single = parsePastedTaskTitles(text);

      if (single.length === 1 && single[0] !== text.trim()) {
        event.preventDefault();
        void submit(single[0]!);
      }

      return;
    }

    event.preventDefault();
    void submitMany(text);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border/50 p-2",
          glass({ opaque: true })
        )}
      >
        <Input
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          disabled={pending}
          placeholder="Quick add…"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          onPaste={handlePaste}
        />
        <Button
          disabled={pending || title.trim().length < 2}
          size="sm"
          type="button"
          onClick={() => void submit()}
        >
          Add
        </Button>
        <Button
          aria-label="Open full editor"
          size="icon"
          type="button"
          variant="ghost"
          onClick={onOpenFullEditor}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
