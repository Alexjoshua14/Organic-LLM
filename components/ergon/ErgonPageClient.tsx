"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { CategoryManager } from "@/components/ergon/CategoryManager";
import { ErgonEmptyState } from "@/components/ergon/ErgonEmptyState";
import { ErgonFilterSheet } from "@/components/ergon/ErgonFilterSheet";
import { ErgonViewSwitcher } from "@/components/ergon/ErgonViewSwitcher";
import { TaskEditorPanel } from "@/components/ergon/TaskEditorPanel";
import { TaskFilters } from "@/components/ergon/TaskFilters";
import { TaskQuickAdd } from "@/components/ergon/TaskQuickAdd";
import { DoneView } from "@/components/ergon/views/DoneView";
import { ListView } from "@/components/ergon/views/ListView";
import { PlanView } from "@/components/ergon/views/PlanView";
import {
  flattenDoneViewTaskIds,
  flattenListViewTaskIds,
  flattenPlanViewTaskIds,
} from "@/lib/ergon/flatten-view-tasks";
import { useErgonTaskListKeyboard } from "@/lib/ergon/use-ergon-task-list-keyboard";
import { useErgonTasks } from "@/lib/ergon/use-ergon-tasks";
import { useTaskCategories } from "@/lib/ergon/use-task-categories";
import {
  DEFAULT_ERGON_FILTERS,
  type EditorState,
  type ErgonView,
  type ListSort,
  type TaskCategoryRow,
  type TaskWithCategory,
} from "@/lib/ergon/types";
import type { TaskInsert } from "@/lib/schemas/tasks";
import { filterTasks, isDoneViewTask, isOpenTask } from "@/lib/ergon/task-view";

type ErgonPageClientProps = {
  initialTasks: TaskWithCategory[];
  initialCategories: TaskCategoryRow[];
};

export function ErgonPageClient({ initialTasks, initialCategories }: ErgonPageClientProps) {
  const { tasks, addTask, updateTask, toggleComplete, toggleActive, deleteTaskWithUndo } =
    useErgonTasks(initialTasks);
  const { categories, createCategory, updateCategory, deleteCategory } =
    useTaskCategories(initialCategories);

  const [view, setView] = useState<ErgonView>("plan");
  const [listSort, setListSort] = useState<ListSort>("priority");
  const [filters, setFilters] = useState(DEFAULT_ERGON_FILTERS);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });

  const filteredTasks = useMemo(() => filterTasks(tasks, filters), [filters, tasks]);

  const viewTasks = useMemo(() => {
    if (view === "done") {
      return filteredTasks.filter((task) => isDoneViewTask(task.status));
    }

    return filteredTasks.filter((task) => isOpenTask(task.status));
  }, [filteredTasks, view]);

  const orderedTaskIds = useMemo(() => {
    if (view === "plan") return flattenPlanViewTaskIds(viewTasks);
    if (view === "list") return flattenListViewTaskIds(viewTasks, categories, listSort);

    return flattenDoneViewTaskIds(viewTasks);
  }, [categories, listSort, view, viewTasks]);

  const { getRowProps } = useErgonTaskListKeyboard(orderedTaskIds);

  const handleChatAbout = useCallback((task: TaskWithCategory) => {
    toast("Chat about this task is coming with Aion", { description: task.title });
  }, []);

  const handleDelete = useCallback(
    (id: string) => void deleteTaskWithUndo(id),
    [deleteTaskWithUndo]
  );

  const editingTask =
    editor.mode === "edit" ? (tasks.find((task) => task.id === editor.taskId) ?? null) : null;

  const openEditor = (next: EditorState) => setEditor(next);
  const closeEditor = () => setEditor({ mode: "closed" });

  const handleQuickAdd = async (input: TaskInsert) => {
    await addTask(input);
  };

  const handleQuickAddMany = async (inputs: TaskInsert[]) => {
    await Promise.all(inputs.map((input) => addTask(input)));
  };

  const showEmpty = tasks.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 py-2 md:gap-6 md:py-6">
      <header className="space-y-2 md:space-y-4">
        <div className="flex items-center gap-2 md:flex-wrap md:items-end md:justify-between md:gap-3">
          <div className="hidden min-w-0 md:block">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Ergon</p>
            <h1 className="font-commissioner text-2xl font-light tracking-wide text-foreground sm:text-3xl">
              Durable todos
            </h1>
          </div>
          <ErgonViewSwitcher
            className="min-w-0 flex-1 md:flex-none md:shrink-0"
            value={view}
            onChange={setView}
          />
          <ErgonFilterSheet
            categories={categories}
            filters={filters}
            className="md:hidden"
            onChange={setFilters}
            onDeleteCategory={deleteCategory}
            onUpdateCategory={updateCategory}
          />
        </div>

        <TaskQuickAdd
          categories={categories}
          onAdd={handleQuickAdd}
          onAddMany={handleQuickAddMany}
          onOpenFullEditor={() => openEditor({ mode: "create" })}
        />

        <div className="hidden space-y-4 md:block">
          <TaskFilters categories={categories} filters={filters} onChange={setFilters} />
          <CategoryManager
            categories={categories}
            onDelete={deleteCategory}
            onUpdate={updateCategory}
          />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-2">
        {showEmpty ? (
          <ErgonEmptyState onStarterSelect={() => openEditor({ mode: "create" })} />
        ) : viewTasks.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No tasks match these filters.
          </p>
        ) : view === "plan" ? (
          <PlanView
            getTaskRowProps={getRowProps}
            tasks={viewTasks}
            onChatAbout={handleChatAbout}
            onDelete={handleDelete}
            onEdit={(task) => openEditor({ mode: "edit", taskId: task.id })}
            onToggleActive={(id) => void toggleActive(id)}
            onToggleComplete={(id) => void toggleComplete(id)}
          />
        ) : view === "list" ? (
          <ListView
            categories={categories}
            getTaskRowProps={getRowProps}
            sort={listSort}
            tasks={viewTasks}
            onChatAbout={handleChatAbout}
            onDelete={handleDelete}
            onEdit={(task) => openEditor({ mode: "edit", taskId: task.id })}
            onSortChange={setListSort}
            onToggleActive={(id) => void toggleActive(id)}
            onToggleComplete={(id) => void toggleComplete(id)}
          />
        ) : (
          <DoneView
            getTaskRowProps={getRowProps}
            tasks={viewTasks}
            onChatAbout={handleChatAbout}
            onDelete={handleDelete}
            onEdit={(task) => openEditor({ mode: "edit", taskId: task.id })}
            onToggleActive={(id) => void toggleActive(id)}
            onToggleComplete={(id) => void toggleComplete(id)}
          />
        )}
      </main>

      <p className="hidden text-center text-[11px] text-muted-foreground/70 md:block">
        Keyboard: ↑/↓ move · Enter expand · Space complete · A active · E edit · Del delete
      </p>

      <TaskEditorPanel
        categories={categories}
        mode={editor.mode === "edit" ? "edit" : "create"}
        open={editor.mode !== "closed"}
        task={editingTask}
        onClose={closeEditor}
        onCreate={(input) => void addTask(input)}
        onCreateCategory={createCategory}
        onUpdate={(id, patch) => void updateTask(id, patch)}
      />
    </div>
  );
}
