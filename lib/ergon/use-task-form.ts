"use client";

import type { TaskWithCategory } from "@/lib/ergon/types";
import type { TaskInsert } from "@/lib/schemas/tasks";

import { useCallback, useState } from "react";

import { parsePlannedInput, toDateInputValue, toDatetimeLocalValue } from "@/lib/ergon/format";
import { MentalEffort, TaskPriority, TaskStatus } from "@/lib/schemas/tasks";

type StatusValue = (typeof TaskStatus.options)[number];
type PriorityValue = (typeof TaskPriority.options)[number];
type EffortValue = (typeof MentalEffort.options)[number];

export type TaskFormController = {
  title: string;
  setTitle: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  categoryId: string | null;
  setCategoryId: (value: string | null) => void;
  priority: string;
  setPriority: (value: string) => void;
  status: StatusValue;
  setStatus: (value: StatusValue) => void;
  dueDate: string;
  setDueDate: (value: string) => void;
  plannedValue: string;
  setPlannedValue: (value: string) => void;
  plannedHasTime: boolean;
  setPlannedHasTime: (value: boolean) => void;
  estMinutes: number | null;
  setEstMinutes: (value: number | null) => void;
  mentalEffort: string;
  setMentalEffort: (value: string) => void;
  isValid: boolean;
  reset: (initial?: Partial<TaskInsert>) => void;
  resetFromTask: (task: TaskWithCategory) => void;
  buildPayload: () => TaskInsert;
};

/** Shared task create/edit form state used by both the inline quick-add and the editor sheet. */
export function useTaskForm(): TaskFormController {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<string>("none");
  const [status, setStatus] = useState<StatusValue>("todo");
  const [dueDate, setDueDate] = useState("");
  const [plannedValue, setPlannedValue] = useState("");
  const [plannedHasTime, setPlannedHasTime] = useState(false);
  const [estMinutes, setEstMinutes] = useState<number | null>(null);
  const [mentalEffort, setMentalEffort] = useState<string>("none");

  const reset = useCallback((initial?: Partial<TaskInsert>) => {
    setTitle(initial?.title ?? "");
    setNotes(initial?.notes ?? "");
    setCategoryId(initial?.category_id ?? null);
    setPriority(initial?.priority ?? "none");
    setStatus((initial?.status as StatusValue) ?? "todo");
    setDueDate(initial?.due_date ?? "");
    setPlannedValue("");
    setPlannedHasTime(false);
    setEstMinutes(initial?.est_minutes ?? null);
    setMentalEffort(initial?.mental_effort ?? "none");
  }, []);

  const resetFromTask = useCallback((task: TaskWithCategory) => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setCategoryId(task.category_id);
    setPriority(task.priority ?? "none");
    setStatus(task.status as StatusValue);
    setDueDate(toDateInputValue(task.due_date));
    setPlannedValue(toDatetimeLocalValue(task.planned_at, task.planned_has_time));
    setPlannedHasTime(task.planned_has_time);
    setEstMinutes(task.est_minutes);
    setMentalEffort(task.mental_effort ?? "none");
  }, []);

  const buildPayload = useCallback((): TaskInsert => {
    const planned = parsePlannedInput(plannedValue, plannedHasTime);

    return {
      title: title.trim(),
      notes: notes.trim() || undefined,
      category_id: categoryId ?? undefined,
      priority: priority === "none" ? null : (priority as PriorityValue),
      status,
      due_date: dueDate || undefined,
      planned_at: planned.planned_at,
      planned_has_time: planned.planned_has_time,
      est_minutes: estMinutes ?? undefined,
      mental_effort: mentalEffort === "none" ? undefined : (mentalEffort as EffortValue),
      tags: [],
    };
  }, [
    categoryId,
    dueDate,
    estMinutes,
    mentalEffort,
    notes,
    plannedHasTime,
    plannedValue,
    priority,
    status,
    title,
  ]);

  return {
    title,
    setTitle,
    notes,
    setNotes,
    categoryId,
    setCategoryId,
    priority,
    setPriority,
    status,
    setStatus,
    dueDate,
    setDueDate,
    plannedValue,
    setPlannedValue,
    plannedHasTime,
    setPlannedHasTime,
    estMinutes,
    setEstMinutes,
    mentalEffort,
    setMentalEffort,
    isValid: title.trim().length >= 2,
    reset,
    resetFromTask,
    buildPayload,
  };
}
