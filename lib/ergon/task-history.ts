/** A reversible action: `undo` returns to the prior state, `redo` re-applies it. */
export type HistoryCommand = {
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
};

export type TaskHistory = {
  record: (command: HistoryCommand) => void;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  size: () => { past: number; future: number };
};

/**
 * Minimal undo/redo stack for Ergon task mutations.
 * Pure and framework-agnostic so it can be unit-tested without React or the data layer.
 * Recording a new command clears the redo stack (standard linear-history behavior).
 */
export function createTaskHistory(): TaskHistory {
  let past: HistoryCommand[] = [];
  let future: HistoryCommand[] = [];

  return {
    record(command) {
      past.push(command);
      future = [];
    },
    canUndo() {
      return past.length > 0;
    },
    canRedo() {
      return future.length > 0;
    },
    async undo() {
      const command = past.pop();

      if (!command) return false;

      try {
        await command.undo();
        future.push(command);

        return true;
      } catch (error) {
        // Restore the stack position so the user can retry.
        past.push(command);
        throw error;
      }
    },
    async redo() {
      const command = future.pop();

      if (!command) return false;

      try {
        await command.redo();
        past.push(command);

        return true;
      } catch (error) {
        future.push(command);
        throw error;
      }
    },
    clear() {
      past = [];
      future = [];
    },
    size() {
      return { past: past.length, future: future.length };
    },
  };
}
