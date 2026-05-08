/**
 * requestAnimationFrame loop for morph integration. Passes **deltaTime in milliseconds** to the tick;
 * caps dt at 100ms so background tabs do not explode the spring state on resume.
 */
export type TickCallback = (payload: { deltaTime: number }) => void;

export class FrameLoop {
  private callback: TickCallback;
  private running: boolean = false;
  private lastTime: number = 0;
  private frameId: number | null = null;

  private static MAX_DT = 100;

  constructor(callback: TickCallback) {
    this.callback = callback;
  }

  public start() {
    if (this.running) return;

    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    this.running = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  private loop = (time: number) => {
    if (!this.running) return;

    let dt = time - this.lastTime;
    this.lastTime = time;

    if (dt > FrameLoop.MAX_DT) dt = FrameLoop.MAX_DT;

    this.callback({ deltaTime: dt });

    this.frameId = requestAnimationFrame(this.loop);
  };
}
