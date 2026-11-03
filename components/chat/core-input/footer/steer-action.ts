/**
 * Noesis "steer": a secondary submit that runs on the draft without sending it to the thread
 * (CoreInput's `onSecondarySubmit`). The same action is reachable from three places: the
 * inline button, the overflow menu item, and Cmd/Ctrl+Enter in the textarea. CoreInput builds
 * one of these so all three share a single guard.
 */
export type SteerAction = {
  label: string;
  /** A steer is running; shows a spinner. */
  pending: boolean;
  /** The draft has text, the surface allows steering, and none is already running. */
  available: boolean;
  /** Runs on the current draft. A no-op when not `available`. */
  run: () => void;
};
