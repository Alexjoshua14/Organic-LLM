import { describe, expect, test } from "bun:test";

import { createTaskHistory } from "@/lib/ergon/task-history";

describe("createTaskHistory", () => {
  test("undo/redo run the matching command callbacks in order", async () => {
    const history = createTaskHistory();
    const log: string[] = [];

    history.record({
      undo: () => {
        log.push("undo:a");
      },
      redo: () => {
        log.push("redo:a");
      },
    });

    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    expect(await history.undo()).toBe(true);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    expect(await history.redo()).toBe(true);
    expect(log).toEqual(["undo:a", "redo:a"]);
  });

  test("recording a new command clears the redo stack", async () => {
    const history = createTaskHistory();

    history.record({ undo: () => {}, redo: () => {} });
    await history.undo();

    expect(history.canRedo()).toBe(true);

    history.record({ undo: () => {}, redo: () => {} });

    expect(history.canRedo()).toBe(false);
    expect(history.size()).toEqual({ past: 1, future: 0 });
  });

  test("undo/redo are no-ops on empty stacks", async () => {
    const history = createTaskHistory();

    expect(await history.undo()).toBe(false);
    expect(await history.redo()).toBe(false);
  });

  test("a failing undo keeps the command on the past stack", async () => {
    const history = createTaskHistory();

    history.record({
      undo: () => {
        throw new Error("boom");
      },
      redo: () => {},
    });

    await expect(history.undo()).rejects.toThrow("boom");
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  test("clear empties both stacks", async () => {
    const history = createTaskHistory();

    history.record({ undo: () => {}, redo: () => {} });
    history.clear();

    expect(history.size()).toEqual({ past: 0, future: 0 });
  });
});
