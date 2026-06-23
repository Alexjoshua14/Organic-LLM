"use client";

import type { ErgonTaskRowKeyboardProps } from "@/lib/ergon/use-ergon-task-list-keyboard";
import type { TaskWithCategory } from "@/lib/ergon/types";
import type { KeyboardEvent } from "react";

import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, CircleDot, MessageCircle, Pencil, Sparkles, Trash2 } from "lucide-react";

import { ErgonTaskActionButton } from "@/components/ergon/ErgonTaskActionButton";
import {
  useChatStyleCardLumen,
  useChatStyleCardLumenHostRef,
} from "@/components/chat/use-chat-style-card-lumen";
import { glass } from "@/components/design-system/primitives";
import {
  formatDueDate,
  formatEstMinutes,
  formatPlannedDate,
  mentalEffortGlyph,
} from "@/lib/ergon/format";
import { ERGON_DOUBLE_TAP_MS } from "@/lib/ergon/task-row-gestures";
import { handleTaskRowKeyDown } from "@/lib/ergon/task-row-keyboard";
import { useTaskRowGestures } from "@/lib/ergon/use-task-row-gestures";
import { cn } from "@/lib/utils";

type TaskRowProps = {
  task: TaskWithCategory;
  onToggleComplete: (id: string) => void | Promise<void>;
  onToggleActive: (id: string) => void | Promise<void>;
  onEdit: (task: TaskWithCategory) => void;
  onDelete: (id: string) => void | Promise<void>;
  onEnhance?: (id: string) => void | Promise<void>;
  onChatAbout?: (task: TaskWithCategory) => void;
  keyboardProps?: ErgonTaskRowKeyboardProps;
};

export function TaskRow({
  task,
  onToggleComplete,
  onToggleActive,
  onEdit,
  onDelete,
  onEnhance,
  onChatAbout,
  keyboardProps,
}: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const hostRef = useChatStyleCardLumenHostRef();
  const lastTapRef = useRef(0);
  const isActive = task.is_active === true;

  useChatStyleCardLumen(hostRef, isActive);

  const gestures = useTaskRowGestures({
    onComplete: () => void onToggleComplete(task.id),
    onActive: () => void onToggleActive(task.id),
    onDelete: () => void onDelete(task.id),
  });

  const gesturesEnabled = gestures.enabled;

  // Touch: single tap expands, double tap starts the chat stub (no expand toggle on the second tap).
  const handleTitleActivate = useCallback(() => {
    if (gesturesEnabled) {
      const now = Date.now();

      if (now - lastTapRef.current < ERGON_DOUBLE_TAP_MS) {
        lastTapRef.current = 0;
        onChatAbout?.(task);

        return;
      }

      lastTapRef.current = now;
    }

    setExpanded((value) => !value);
  }, [gesturesEnabled, onChatAbout, task]);

  const gestureSetRef = gestures.setRowElement;
  const keyboardSetRef = keyboardProps?.setRowRef;

  const setRowNode = useCallback(
    (node: HTMLDivElement | null) => {
      gestureSetRef(node);
      keyboardSetRef?.(node);
    },
    [gestureSetRef, keyboardSetRef]
  );

  const handleEnhance = useCallback(async () => {
    if (!onEnhance || enhancing) return;

    setEnhancing(true);

    try {
      await onEnhance(task.id);
    } finally {
      setEnhancing(false);
    }
  }, [enhancing, onEnhance, task.id]);

  const onRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;

      const action = handleTaskRowKeyDown(event, { expanded });

      if (!action) return;

      switch (action) {
        case "next":
        case "prev":
        case "first":
        case "last":
          keyboardProps?.onNavigate(action);
          break;
        case "toggleExpand":
          setExpanded((value) => !value);
          break;
        case "collapse":
          setExpanded(false);
          break;
        case "complete":
          void onToggleComplete(task.id);
          break;
        case "active":
          void onToggleActive(task.id);
          break;
        case "edit":
          onEdit(task);
          break;
        case "delete":
          void onDelete(task.id);
          break;
        case "chatAbout":
          onChatAbout?.(task);
          break;
      }
    },
    [expanded, keyboardProps, onChatAbout, onDelete, onEdit, onToggleActive, onToggleComplete, task]
  );

  const categoryColor = task.category?.color ?? null;
  const plannedLabel = formatPlannedDate(task.planned_at, task.planned_has_time);
  const dueLabel = formatDueDate(task.due_date);
  const durationLabel = formatEstMinutes(task.est_minutes);
  const effortLabel = mentalEffortGlyph(task.mental_effort);
  const isDone = task.status === "done" || task.status === "archived";

  const { offset, preview, swiping, handlers } = gestures;

  const cardStyle = gesturesEnabled
    ? {
        transform: `translateX(${offset}px)`,
        transition: swiping ? "none" : "transform 200ms ease-out",
      }
    : undefined;

  return (
    <span ref={hostRef} className="chat-style-card-host block w-full">
      <span className="chat-style-card-stage relative block w-full">
        {isActive ? <span aria-hidden className="chat-style-lumen-rim" /> : null}
        <div
          ref={setRowNode}
          aria-keyshortcuts="Enter Space a e Delete c"
          aria-label={task.title}
          className={cn(
            "relative overflow-hidden rounded-xl outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          )}
          data-ergon-task-row={task.id}
          role="listitem"
          style={gesturesEnabled ? { touchAction: "pan-y" } : undefined}
          tabIndex={keyboardProps ? keyboardProps.tabIndex : 0}
          onFocus={keyboardProps?.onFocus}
          onKeyDown={onRowKeyDown}
          {...(handlers ?? {})}
        >
          {gesturesEnabled && offset !== 0 ? (
            <>
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-0 left-0 z-0 flex w-2/3 items-center justify-start gap-2 rounded-xl pl-4 text-sm font-medium transition-colors",
                  preview === "active"
                    ? "bg-[rgb(var(--lumen)/0.14)] text-lumen"
                    : "bg-emerald-500/10 text-emerald-500"
                )}
              >
                {preview === "active" ? (
                  <>
                    <CircleDot className="size-4" />
                    Active
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Complete
                  </>
                )}
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-0 flex w-2/3 items-center justify-end gap-2 rounded-xl pr-4 text-sm font-medium text-red-500 transition-colors bg-red-500/10"
              >
                Delete
                <Trash2 className="size-4" />
              </div>
            </>
          ) : null}

          <div
            className={cn(
              "chat-style-card relative z-10 rounded-xl border border-border/50 transition-colors",
              glass({ opaque: true }),
              expanded && "border-border/70",
              isActive &&
                "border-[rgb(var(--lumen-rim)/0.28)] shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]"
            )}
            style={cardStyle}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
              <input
                aria-label={`Mark ${task.title} complete`}
                checked={isDone}
                className="size-4 shrink-0 accent-accent"
                type="checkbox"
                onChange={() => void onToggleComplete(task.id)}
              />

              <button
                className="min-w-0 flex-1 text-left"
                tabIndex={-1}
                type="button"
                onClick={handleTitleActivate}
              >
                <div className="flex items-center gap-2">
                  {categoryColor ? (
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryColor }}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium text-foreground select-text",
                        isDone && "text-muted-foreground line-through"
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground select-none">
                      {isActive ? <span className="select-text text-lumen">Active</span> : null}
                      {plannedLabel ? <span>{plannedLabel}</span> : null}
                      {dueLabel ? <span>{dueLabel}</span> : null}
                      {durationLabel ? <span>{durationLabel}</span> : null}
                      {effortLabel ? <span aria-label="Mental effort">{effortLabel}</span> : null}
                      {task.priority ? <span className="capitalize">{task.priority}</span> : null}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-180"
                    )}
                  />
                </div>
              </button>
            </div>

            {expanded ? (
              <div className="border-t border-border/40 px-3 py-3 sm:px-4">
                {task.notes ? (
                  <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {task.notes}
                  </p>
                ) : (
                  <p className="mb-3 text-sm text-muted-foreground/70">No description yet.</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <ErgonTaskActionButton
                    engaged={isActive}
                    type="button"
                    onClick={() => void onToggleActive(task.id)}
                  >
                    <CircleDot className="size-3.5" />
                    {isActive ? "Active" : "Mark active"}
                  </ErgonTaskActionButton>
                  <ErgonTaskActionButton type="button" onClick={() => onEdit(task)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </ErgonTaskActionButton>
                  {onEnhance ? (
                    <ErgonTaskActionButton
                      disabled={enhancing}
                      type="button"
                      onClick={() => void handleEnhance()}
                    >
                      <Sparkles className={cn("size-3.5", enhancing && "animate-pulse")} />
                      {enhancing ? "Enhancing…" : "Enhance"}
                    </ErgonTaskActionButton>
                  ) : null}
                  {onChatAbout ? (
                    <ErgonTaskActionButton type="button" onClick={() => onChatAbout(task)}>
                      <MessageCircle className="size-3.5" />
                      Chat
                    </ErgonTaskActionButton>
                  ) : null}
                  <ErgonTaskActionButton
                    danger
                    type="button"
                    onClick={() => void onDelete(task.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </ErgonTaskActionButton>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </span>
    </span>
  );
}
