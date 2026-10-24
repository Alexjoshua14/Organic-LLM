import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";

import { TaskRow } from "@/components/ergon/TaskRow";
import { useErgonTaskListKeyboard } from "@/lib/ergon/use-ergon-task-list-keyboard";
import { useTaskRowGestures } from "@/lib/ergon/use-task-row-gestures";
import type { TaskWithCategory } from "@/lib/ergon/types";

import { render } from "../helpers/render";

afterEach(() => cleanup());

function stubTouchMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: true,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function clearMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

function task(id: string, title: string): TaskWithCategory {
  return {
    id,
    title,
    notes: null,
    tags: [],
    due_date: null,
    priority: null,
    status: "todo",
    category_id: null,
    planned_at: null,
    planned_has_time: false,
    est_minutes: null,
    mental_effort: null,
    completed_at: null,
    is_active: false,
    owner_id: "owner",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    category: null,
  };
}

type ActionLog = { type: string; id: string };

function Harness({ onAction }: { onAction: (entry: ActionLog) => void }) {
  const tasks = [task("a", "Task A"), task("b", "Task B")];
  const { getRowProps } = useErgonTaskListKeyboard(tasks.map((t) => t.id));

  return (
    <div>
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          keyboardProps={getRowProps(t.id)}
          task={t}
          onChatAbout={(value) => onAction({ type: "chat", id: value.id })}
          onDelete={(id) => onAction({ type: "delete", id })}
          onEdit={(value) => onAction({ type: "edit", id: value.id })}
          onToggleActive={(id) => onAction({ type: "active", id })}
          onToggleComplete={(id) => onAction({ type: "complete", id })}
        />
      ))}
    </div>
  );
}

function rows(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-ergon-task-row]"));
}

describe("TaskRow keyboard", () => {
  test("first row is the roving tab stop", () => {
    const { container } = render(<Harness onAction={() => {}} />);
    const [rowA, rowB] = rows(container);

    expect(rowA?.getAttribute("tabindex")).toBe("0");
    expect(rowB?.getAttribute("tabindex")).toBe("-1");
  });

  test("ArrowDown moves roving focus to the next row", () => {
    const { container } = render(<Harness onAction={() => {}} />);
    const [rowA, rowB] = rows(container);

    fireEvent.keyDown(rowA!, { key: "ArrowDown" });

    expect(rowA?.getAttribute("tabindex")).toBe("-1");
    expect(rowB?.getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(rowB);
  });

  test("ArrowUp clamps at the first row", () => {
    const { container } = render(<Harness onAction={() => {}} />);
    const [rowA] = rows(container);

    fireEvent.keyDown(rowA!, { key: "ArrowUp" });

    expect(rowA?.getAttribute("tabindex")).toBe("0");
  });

  test("action keys invoke the matching handler for the focused row", () => {
    const log: ActionLog[] = [];
    const { container } = render(<Harness onAction={(entry) => log.push(entry)} />);
    const [rowA] = rows(container);

    fireEvent.keyDown(rowA!, { key: " " });
    fireEvent.keyDown(rowA!, { key: "a" });
    fireEvent.keyDown(rowA!, { key: "e" });
    fireEvent.keyDown(rowA!, { key: "Delete" });
    fireEvent.keyDown(rowA!, { key: "c" });

    expect(log).toEqual([
      { type: "complete", id: "a" },
      { type: "active", id: "a" },
      { type: "edit", id: "a" },
      { type: "delete", id: "a" },
      { type: "chat", id: "a" },
    ]);
  });

  test("Enter expands the focused row", () => {
    const { container } = render(<Harness onAction={() => {}} />);
    const [rowA] = rows(container);

    expect(container.textContent).not.toContain("No description yet.");

    fireEvent.keyDown(rowA!, { key: "Enter" });

    expect(container.textContent).toContain("No description yet.");
  });
});

describe("useTaskRowGestures", () => {
  function setup() {
    const calls = { complete: 0, active: 0, delete: 0 };
    const { result } = renderHook(() =>
      useTaskRowGestures({
        enabled: true,
        onComplete: () => {
          calls.complete += 1;
        },
        onActive: () => {
          calls.active += 1;
        },
        onDelete: () => {
          calls.delete += 1;
        },
      })
    );

    const element = {
      getBoundingClientRect: () => ({ width: 300 }) as DOMRect,
      setPointerCapture: () => {},
    } as unknown as HTMLElement;

    act(() => result.current.setRowElement(element));

    return { calls, result };
  }

  function swipe(
    result: { current: ReturnType<typeof useTaskRowGestures> },
    from: number,
    to: number,
    deltaY = 0
  ) {
    const handlers = result.current.handlers;

    if (!handlers) throw new Error("gestures disabled");

    act(() => {
      handlers.onPointerDown({ pointerType: "touch", pointerId: 1, clientX: from, clientY: 0 } as never);
    });
    act(() => {
      handlers.onPointerMove({
        pointerId: 1,
        clientX: to,
        clientY: deltaY,
        cancelable: false,
      } as never);
    });
    act(() => {
      handlers.onPointerUp({ pointerId: 1, clientX: to, clientY: deltaY } as never);
    });
  }

  test("right long swipe toggles active", () => {
    const { calls, result } = setup();

    swipe(result, 0, 200);

    expect(calls.active).toBe(1);
    expect(calls.complete).toBe(0);
  });

  test("right short swipe completes", () => {
    const { calls, result } = setup();

    swipe(result, 0, 110);

    expect(calls.complete).toBe(1);
    expect(calls.active).toBe(0);
  });

  test("left long swipe deletes", () => {
    const { calls, result } = setup();

    swipe(result, 300, 100);

    expect(calls.delete).toBe(1);
  });

  test("vertical-dominant gesture scrolls (no action)", () => {
    const { calls, result } = setup();

    swipe(result, 0, 20, 120);

    expect(calls.complete + calls.active + calls.delete).toBe(0);
  });

  test("mouse pointers are ignored (desktop uses buttons + keyboard)", () => {
    const { calls, result } = setup();
    const handlers = result.current.handlers!;

    act(() => {
      handlers.onPointerDown({ pointerType: "mouse", pointerId: 1, clientX: 0, clientY: 0 } as never);
    });
    act(() => {
      handlers.onPointerUp({ pointerId: 1, clientX: 200, clientY: 0 } as never);
    });

    expect(calls.complete + calls.active + calls.delete).toBe(0);
  });
});

describe("TaskRow double-tap (touch)", () => {
  beforeEach(() => stubTouchMatchMedia());
  afterEach(() => clearMatchMedia());

  function renderRow(onAction: (entry: ActionLog) => void) {
    return render(
      <TaskRow
        task={task("a", "Task A")}
        onChatAbout={(value) => onAction({ type: "chat", id: value.id })}
        onDelete={() => {}}
        onEdit={() => {}}
        onToggleActive={() => {}}
        onToggleComplete={() => {}}
      />
    );
  }

  test("single tap expands the row without starting chat", () => {
    const log: ActionLog[] = [];
    const { container, getByText } = renderRow((entry) => log.push(entry));

    fireEvent.click(getByText("Task A"));

    expect(container.textContent).toContain("No description yet.");
    expect(log).toEqual([]);
  });

  test("double tap starts the chat stub", () => {
    const log: ActionLog[] = [];
    const { getByText } = renderRow((entry) => log.push(entry));
    const title = getByText("Task A");

    fireEvent.click(title);
    fireEvent.click(title);

    expect(log).toEqual([{ type: "chat", id: "a" }]);
  });
});
