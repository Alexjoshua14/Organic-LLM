"use client";

import type { TaskCategoryRow } from "@/lib/ergon/types";
import type { TaskInsert } from "@/lib/schemas/tasks";

import { useState } from "react";
import { ChevronUp, Plus } from "lucide-react";
import { toast } from "sonner";

import { TaskFields } from "@/components/ergon/TaskFields";
import { glass } from "@/components/design-system/primitives";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import { isMultiLinePaste, parsePastedTaskTitles } from "@/lib/ergon/parse-paste";
import { refineQuickAddCaptures } from "@/lib/ergon/refine-quick-add-client";
import { useTaskForm } from "@/lib/ergon/use-task-form";
import { cn } from "@/lib/utils";

type TaskQuickAddProps = {
  categories: TaskCategoryRow[];
  onAdd: (input: TaskInsert) => void | Promise<void>;
  onAddMany: (inputs: TaskInsert[]) => void | Promise<void>;
  onOpenFullEditor: (draft?: Partial<TaskInsert>) => void;
  onCreateCategory: (input: { name: string; color?: string }) => Promise<TaskCategoryRow>;
  className?: string;
};

export function TaskQuickAdd({
  categories,
  onAdd,
  onAddMany,
  onOpenFullEditor,
  onCreateCategory,
  className,
}: TaskQuickAddProps) {
  const form = useTaskForm();
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isMobile = useIsMobile();

  const submit = async (raw?: string) => {
    const trimmed = (raw ?? form.title).trim();

    if (trimmed.length < 2 || pending) return;

    setPending(true);

    try {
      const [refined] = await refineQuickAddCaptures([trimmed], categories);

      await onAdd(refined ?? { title: trimmed, tags: [] });
      form.setTitle("");
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

      form.setTitle("");
    } finally {
      setPending(false);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (expanded) return;

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

  // Mobile: carry the typed title into the full editor sheet. Desktop: expand inline.
  const toggleDetails = () => {
    if (isMobile) {
      onOpenFullEditor({ title: form.title.trim() || undefined });

      return;
    }

    setExpanded((value) => !value);
  };

  const addDetailed = async () => {
    if (!form.isValid || pending) return;

    setPending(true);

    try {
      await onAdd(form.buildPayload());
      form.reset();
      setExpanded(false);
    } finally {
      setPending(false);
    }
  };

  const cancelDetailed = () => {
    form.reset();
    setExpanded(false);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/50 p-2",
        glass({ opaque: true }),
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Input
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          disabled={pending}
          placeholder={expanded ? "Task title" : "Quick add or paste a checklist…"}
          value={form.title}
          onChange={(event) => form.setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !expanded) {
              event.preventDefault();
              void submit();
            }
          }}
          onPaste={handlePaste}
        />
        {!expanded ? (
          <Button
            disabled={pending || form.title.trim().length < 2}
            size="sm"
            type="button"
            onClick={() => void submit()}
          >
            Add
          </Button>
        ) : null}
        <Button
          aria-label={expanded ? "Hide details" : "Add details"}
          size="icon"
          type="button"
          variant="ghost"
          onClick={toggleDetails}
        >
          {expanded ? <ChevronUp className="size-4" /> : <Plus className="size-4" />}
        </Button>
      </div>

      {expanded ? (
        <div className="hidden flex-col gap-3 border-t border-border/40 pt-3 md:flex">
          <TaskFields
            categories={categories}
            form={form}
            layout="inline"
            onCreateCategory={onCreateCategory}
          />
          <div className="flex items-center justify-end gap-2">
            <Button disabled={pending} type="button" variant="ghost" onClick={cancelDetailed}>
              Cancel
            </Button>
            <Button
              disabled={pending || !form.isValid}
              type="button"
              onClick={() => void addDetailed()}
            >
              Add task
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
