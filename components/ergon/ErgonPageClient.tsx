"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ErgonControlsHelp } from "@/components/ergon/ErgonControlsHelp";
import { ErgonEmptyState } from "@/components/ergon/ErgonEmptyState";
import { ErgonExpandableSearch } from "@/components/ergon/ErgonExpandableSearch";
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
import { isEditableEventTarget } from "@/lib/dom/is-editable-event-target";

type ErgonPageClientProps = {
  initialTasks: TaskWithCategory[];
  initialCategories: TaskCategoryRow[];
};

export function ErgonPageClient({ initialTasks, initialCategories }: ErgonPageClientProps) {
  const { tasks, addTask, updateTask, toggleComplete, toggleActive, deleteTaskWithUndo, enhanceTask, undo, redo } =
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

  const handleEnhance = useCallback((id: string) => void enhanceTask(id), [enhanceTask]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (isEditableEventTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === "z") {
        event.preventDefault();
        void (event.shiftKey ? redo() : undo());
      } else if (key === "y") {
        event.preventDefault();
        void redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

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
      <header className="space-y-2 md:space-y-3">
        <div className="flex items-center gap-2 md:justify-between">
          <div className="hidden min-w-0 md:block">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">Ergon</p>
            <h1 className="font-commissioner text-2xl font-light tracking-wide text-foreground sm:text-3xl">
              Durable todos
            </h1>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none">
            <ErgonExpandableSearch
              value={filters.search}
              onChange={(search) => setFilters((prev) => ({ ...prev, search }))}
            />
            <ErgonViewSwitcher className="min-w-0 flex-1 shrink-0 md:flex-none" value={view} onChange={setView} />
            <ErgonControlsHelp />
            <ErgonFilterSheet
              categories={categories}
              filters={filters}
              className="hidden md:inline-flex"
              variant="desktop"
              onChange={setFilters}
              onDeleteCategory={deleteCategory}
              onUpdateCategory={updateCategory}
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
        </div>

        <TaskQuickAdd
          categories={categories}
          onAdd={handleQuickAdd}
          onAddMany={handleQuickAddMany}
          onCreateCategory={createCategory}
          onOpenFullEditor={(draft) => openEditor({ mode: "create", draft })}
        />

        <div className="hidden md:block">
          <TaskFilters
            categories={categories}
            compact
            filters={filters}
            onChange={setFilters}
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
            onEnhance={handleEnhance}
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
            onEnhance={handleEnhance}
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
            onEnhance={handleEnhance}
            onToggleActive={(id) => void toggleActive(id)}
            onToggleComplete={(id) => void toggleComplete(id)}
          />
        )}
      </main>

      <TaskEditorPanel
        categories={categories}
        initialDraft={editor.mode === "create" ? editor.draft : undefined}
        mode={editor.mode === "edit" ? "edit" : "create"}
        open={editor.mode !== "closed"}
        task={editingTask}
        onClose={closeEditor}
        onCreate={(input) => void addTask(input)}
        onCreateCategory={createCategory}
        onEnhance={handleEnhance}
        onUpdate={(id, patch) => void updateTask(id, patch)}
      />
    </div>
  );
}
