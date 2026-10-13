import { DotPhysicsScheduler } from "@/components/agents/dot-physics-scheduler";

export function schedulerFixture() {
  let now = 0;
  let hidden = false;
  let visibility = () => {};
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const scheduler = new DotPhysicsScheduler({
    requestFrame: (callback) => {
      frames.set(++id, callback);
      return id;
    },
    cancelFrame: (key) => {
      frames.delete(key);
    },
    now: () => now,
    hidden: () => hidden,
    onVisibility: (callback) => {
      visibility = callback;
      return () => {
        visibility = () => {};
      };
    },
  });
  return {
    scheduler,
    frames,
    frame(dt: number) {
      now += dt;
      const [key, callback] = frames.entries().next().value!;
      frames.delete(key);
      callback(now);
    },
    cost(ms: number) {
      now += ms;
    },
    hide(value: boolean) {
      hidden = value;
      visibility();
    },
  };
}
