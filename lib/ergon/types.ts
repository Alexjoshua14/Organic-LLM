import type { Tables } from "@/lib/supabase/types";
import type { TaskInsert } from "@/lib/schemas/tasks";

export type TaskRow = Tables<"tasks">;
export type TaskCategoryRow = Tables<"task_categories">;

/** Task row with optional joined category from Supabase select. */
export type TaskWithCategory = TaskRow & {
  category: TaskCategoryRow | null;
};

export type ErgonView = "plan" | "list" | "done";

export type ListSort = "priority" | "due";

export type ErgonFilters = {
  search: string;
  categoryIds: string[];
  priorities: Array<TaskRow["priority"] extends infer P ? (P extends string ? P : never) : never>;
  mentalEfforts: Array<
    TaskRow["mental_effort"] extends infer M ? (M extends string ? M : never) : never
  >;
  statuses: Array<TaskRow["status"] extends infer S ? (S extends string ? S : never) : never>;
};

export const DEFAULT_ERGON_FILTERS: ErgonFilters = {
  search: "",
  categoryIds: [],
  priorities: [],
  mentalEfforts: [],
  statuses: [],
};

export type EditorState =
  | { mode: "closed" }
  | { mode: "create"; draft?: Partial<TaskInsert> }
  | { mode: "edit"; taskId: string };
