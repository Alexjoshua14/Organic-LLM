"use client";

import type { TaskCategoryRow, TaskWithCategory } from "@/lib/ergon/types";
import type { TaskInsert, TaskPatch } from "@/lib/schemas/tasks";

import { useEffect, useState } from "react";

import { CategoryPicker } from "@/components/ergon/CategoryPicker";
import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/third-party/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/third-party/ui/sheet";
import { Switch } from "@/components/third-party/ui/switch";
import { Textarea } from "@/components/third-party/ui/textarea";
import { parsePlannedInput, toDateInputValue, toDatetimeLocalValue } from "@/lib/ergon/format";
import { MentalEffort, TaskPriority, TaskStatus } from "@/lib/schemas/tasks";
import { cn } from "@/lib/utils";

const EST_QUICK_PICKS = [15, 30, 60, 120, 240] as const;

type TaskEditorPanelProps = {
  open: boolean;
  mode: "create" | "edit";
  task: TaskWithCategory | null;
  categories: TaskCategoryRow[];
  onClose: () => void;
  onCreate: (input: TaskInsert) => void | Promise<void>;
  onUpdate: (id: string, patch: TaskPatch) => void | Promise<void>;
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
  onCreateCategory,
  initialDraft,
}: TaskEditorPanelProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<string>("none");
  const [status, setStatus] = useState<(typeof TaskStatus.options)[number]>("todo");
  const [dueDate, setDueDate] = useState("");
  const [plannedValue, setPlannedValue] = useState("");
  const [plannedHasTime, setPlannedHasTime] = useState(false);
  const [estMinutes, setEstMinutes] = useState<number | null>(null);
  const [mentalEffort, setMentalEffort] = useState<string>("none");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
      setCategoryId(task.category_id);
      setPriority(task.priority ?? "none");
      setStatus(task.status as (typeof TaskStatus.options)[number]);
      setDueDate(toDateInputValue(task.due_date));
      setPlannedValue(toDatetimeLocalValue(task.planned_at, task.planned_has_time));
      setPlannedHasTime(task.planned_has_time);
      setEstMinutes(task.est_minutes);
      setMentalEffort(task.mental_effort ?? "none");

      return;
    }

    setTitle(initialDraft?.title ?? "");
    setNotes(initialDraft?.notes ?? "");
    setCategoryId(initialDraft?.category_id ?? null);
    setPriority(initialDraft?.priority ?? "none");
    setStatus(initialDraft?.status ?? "todo");
    setDueDate(initialDraft?.due_date ?? "");
    setPlannedValue("");
    setPlannedHasTime(false);
    setEstMinutes(initialDraft?.est_minutes ?? null);
    setMentalEffort(initialDraft?.mental_effort ?? "none");
  }, [initialDraft, mode, open, task]);

  const buildPayload = (): TaskInsert | TaskPatch => {
    const planned = parsePlannedInput(plannedValue, plannedHasTime);

    return {
      title: title.trim(),
      notes: notes.trim() || undefined,
      category_id: categoryId ?? undefined,
      priority: priority === "none" ? null : (priority as (typeof TaskPriority.options)[number]),
      status,
      due_date: dueDate || undefined,
      planned_at: planned.planned_at,
      planned_has_time: planned.planned_has_time,
      est_minutes: estMinutes ?? undefined,
      mental_effort:
        mentalEffort === "none"
          ? undefined
          : (mentalEffort as (typeof MentalEffort.options)[number]),
      tags: [],
    };
  };

  const save = async () => {
    if (title.trim().length < 2 || pending) return;

    setPending(true);

    try {
      const payload = buildPayload();

      if (mode === "edit" && task) {
        await onUpdate(task.id, payload);
      } else {
        await onCreate(payload as TaskInsert);
      }

      onClose();
    } finally {
      setPending(false);
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
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            placeholder="Description"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            onCreateCategory={onCreateCategory}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No priority</SelectItem>
                {TaskPriority.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {TaskStatus.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Planned</span>
            <Input
              type={plannedHasTime ? "datetime-local" : "date"}
              value={plannedValue}
              onChange={(event) => setPlannedValue(event.target.value)}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={plannedHasTime} onCheckedChange={setPlannedHasTime} />
              Include time
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Due date</span>
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Duration</span>
            <div className="flex flex-wrap gap-1.5">
              {EST_QUICK_PICKS.map((minutes) => (
                <Button
                  key={minutes}
                  size="sm"
                  type="button"
                  variant={estMinutes === minutes ? "default" : "outline"}
                  onClick={() => setEstMinutes(minutes)}
                >
                  {minutes}m
                </Button>
              ))}
              <Input
                className="w-20"
                min={1}
                placeholder="Custom"
                type="number"
                value={estMinutes ?? ""}
                onChange={(event) =>
                  setEstMinutes(event.target.value ? Number(event.target.value) : null)
                }
              />
            </div>
          </div>

          <Select value={mentalEffort} onValueChange={setMentalEffort}>
            <SelectTrigger>
              <SelectValue placeholder="Mental effort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No effort set</SelectItem>
              {MentalEffort.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SheetFooter className="px-4 pb-4">
          <Button disabled={pending} type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || title.trim().length < 2}
            type="button"
            onClick={() => void save()}
          >
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
