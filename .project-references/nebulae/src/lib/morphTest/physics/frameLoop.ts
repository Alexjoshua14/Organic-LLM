import z from "zod";

/**
 * FrameLoop manages a requestAnimationFrame-based animation loop for physics simulations.
 *
 * Provides a controlled animation loop that:
 * - Calculates delta time between frames
 * - Clamps delta time to prevent physics explosions when the tab is backgrounded
 * - Calls a tick callback each frame with the delta time
 * - Can be started and stopped on demand
 *
 * Used by useMorphPhysics to drive spring-based animations.
 */

/**
 * Capped delta time interface.
 * Value should be in milliseconds and clamped to a maximum of 100ms.
 */
const DeltaTimeMsSchema = z.object({
  /**
   * Elapsed time between frames, in milliseconds.
   * Value is clamped so that it never exceeds 100.
   */
  deltaTime: z
    .number()
    .min(0, { message: "deltaTime must be >= 0ms" })
    .max(100, { message: "deltaTime cannot exceed 100ms (frame cap)" }),
});

type DeltaTimeMs = z.infer<typeof DeltaTimeMsSchema>;

export type TickCallback = (deltaTime: DeltaTimeMs) => void;

/**
 * Manages an animation loop using requestAnimationFrame.
 * Tracks frame timing, calculates delta time, and invokes a callback each frame.
 */
export class FrameLoop {
  private callback: TickCallback;
  private running: boolean = false;
  private lastTime: number = 0;
  private frameId: number | null = null;

  // Clamp large dt to prevent physics explosions (e.g., tab backgrounded)
  private static MAX_DT = 100; // 100 ms

  constructor(callback: TickCallback) {
    this.callback = callback;
  }

  /**
   * Starts the animation loop.
   * Initializes timing and begins the requestAnimationFrame cycle.
   * Safe to call multiple times (idempotent).
   */
  public start() {
    if (this.running) return;

    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  /**
   * Stops the animation loop.
   * Cancels any pending animation frame and sets running to false.
   * Safe to call multiple times (idempotent).
   */
  public stop() {
    this.running = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Main animation loop function.
   * Called each frame by requestAnimationFrame. Calculates delta time,
   * clamps it to prevent large jumps (e.g., when tab is backgrounded),
   * invokes the callback, and schedules the next frame.
   */
  private loop = (time: number) => {
    if (!this.running) return;

    // Calculate dt in ms
    let dt = time - this.lastTime;
    this.lastTime = time;

    // Safety clamp: prevents physics explosions when tab is backgrounded
    // and then foregrounded, which can cause very large delta times
    if (dt > FrameLoop.MAX_DT) dt = FrameLoop.MAX_DT;

    // Run physics simulation with clamped delta time
    this.callback({ deltaTime: dt });

    // Schedule next frame
    this.frameId = requestAnimationFrame(this.loop);
  };
}
