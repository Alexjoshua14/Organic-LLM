"use client";

import type { TaskCategoryRow, TaskWithCategory } from "@/lib/ergon/types";
import type { TaskInsert, TaskPatch } from "@/lib/schemas/tasks";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { TaskFields } from "@/components/ergon/TaskFields";
import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/third-party/ui/sheet";
import { useTaskForm } from "@/lib/ergon/use-task-form";
import { cn } from "@/lib/utils";

type TaskEditorPanelProps = {
  open: boolean;
  mode: "create" | "edit";
  task: TaskWithCategory | null;
  categories: TaskCategoryRow[];
  onClose: () => void;
  onCreate: (input: TaskInsert) => void | Promise<void>;
  onUpdate: (id: string, patch: TaskPatch) => void | Promise<void>;
  onEnhance?: (id: string) => void | Promise<void>;
  onCreateCategory: (input: { name: string; color?: string }) => Promise<TaskCategoryRow>;
  initialDraft?: Partial<TaskInsert>;
};

export function TaskEditorPanel({
  open,
  mode,
  task,
  categories,
  onClose,
  onCreate,
  onUpdate,
  onEnhance,
  onCreateCategory,
  initialDraft,
}: TaskEditorPanelProps) {
  const form = useTaskForm();
  const { reset, resetFromTask, buildPayload, isValid } = form;
  const [pending, setPending] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && task) {
      resetFromTask(task);

      return;
    }

    reset(initialDraft);
  }, [initialDraft, mode, open, reset, resetFromTask, task]);

  const save = async () => {
    if (!isValid || pending) return;

    setPending(true);

    try {
      const payload = buildPayload();

      if (mode === "edit" && task) {
        await onUpdate(task.id, payload);
      } else {
        await onCreate(payload);
      }

      onClose();
    } finally {
      setPending(false);
    }
  };

  const enhance = async () => {
    if (mode !== "edit" || !task || !onEnhance || enhancing || pending) return;

    setEnhancing(true);

    try {
      await onEnhance(task.id);
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        className={cn("w-full overflow-y-auto sm:max-w-md", glass({ opaque: true }))}
        side="right"
      >
        <SheetHeader>
          <SheetTitle>{mode === "edit" ? "Edit task" : "New task"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-4">
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(event) => form.setTitle(event.target.value)}
          />

          <TaskFields
            categories={categories}
            form={form}
            layout="stacked"
            onCreateCategory={onCreateCategory}
          />
        </div>

        <SheetFooter className="px-4 pb-4">
          {mode === "edit" && task && onEnhance ? (
            <Button
              className="mr-auto"
              disabled={pending || enhancing}
              type="button"
              variant="outline"
              onClick={() => void enhance()}
            >
              <Sparkles className={cn("size-3.5", enhancing && "animate-pulse")} />
              {enhancing ? "Enhancing…" : "Enhance"}
            </Button>
          ) : null}
          <Button disabled={pending || enhancing} type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || enhancing || !isValid} type="button" onClick={() => void save()}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
