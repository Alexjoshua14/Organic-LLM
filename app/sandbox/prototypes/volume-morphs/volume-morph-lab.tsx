"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState, type FormEvent } from "react";
import { volumeResponse, type Volume } from "@organic-llm/morph-physics";

import {
  applyCommand,
  bounds,
  commandSchema,
  createDemoScene,
  scenarios,
  square,
  type Scenario,
} from "./scene";

const cells = Array.from({ length: bounds.w * bounds.h }, (_, index) => index);
const control =
  "organic-focus min-h-11 rounded-md border border-border bg-background px-inset-sm text-sm";

function percent(value: number, extent: number) {
  return `${(100 * value) / extent}%`;
}

export function VolumeMorphLab() {
  const [scenario, setScenario] = useState<Scenario>("Equal peers");
  const [gutter, setGutter] = useState(0.5);
  const [scene, setScene] = useState(() => createDemoScene(scenario, gutter));
  const [target, setTarget] = useState<Volume>(() => square(8.5, 6));
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [, refresh] = useState(0);
  const [run, requestFrameLoop] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    function tick(now: number) {
      scene.step(Math.max(0, now - last), Boolean(reducedMotion));
      last = now;
      refresh((value) => value + 1);
      if (scene.active) frame = requestAnimationFrame(tick);
    }
    if (scene.active) frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [scene, reducedMotion, run]);

  function reset(next: Scenario, gap: number) {
    setScenario(next);
    setGutter(gap);
    setScene(createDemoScene(next, gap));
    setTarget(square(8.5, 6, next === "Depth clearance" ? 2 : 0));
    setStatus("");
  }

  function move() {
    const result = scene.move("B", target);

    setStatus(
      result === "blocked"
        ? "B will stop at first contact."
        : result === "moving"
          ? "Moving B."
          : "Invalid target."
    );
    requestFrameLoop((value) => value + 1);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !message.trim()) return;
    setPending(true);
    try {
      const response = await fetch("/api/prototypes/volume-morphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data: unknown = await response.json();
      const command = commandSchema.safeParse(data);

      if (!response.ok || !command.success) {
        setStatus("The designer could not return a scene command.");

        return;
      }
      setStatus(applyCommand(scene, command.data));
      requestFrameLoop((value) => value + 1);
      refresh((value) => value + 1);
    } catch {
      setStatus("The designer is unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex w-full max-w-4xl flex-col gap-stack-md p-inset-md">
      <h1 className="text-xl font-semibold">Volume morphs</h1>
      <div className="flex flex-wrap gap-inline-sm">
        {scenarios.map((item) => (
          <button
            key={item}
            type="button"
            className={`${control} aria-pressed:bg-muted`}
            aria-pressed={scenario === item}
            disabled={pending}
            onClick={() => reset(item, gutter)}
          >
            {item}
          </button>
        ))}
      </div>
      <figure className="flex flex-col gap-stack-xs">
        <figcaption className="flex justify-between text-xs text-muted-foreground">
          <span>x → · 0–20</span>
          <span>y ↓ · 0–15</span>
          <span>z · 0–6</span>
        </figcaption>
        <div
          className="relative overflow-hidden rounded-md border border-border bg-background"
          style={{ aspectRatio: bounds.w / bounds.h }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${bounds.w}, minmax(0, 1fr))` }}
          >
            {cells.map((cell) => (
              <div key={cell} className="border-b border-r border-border" />
            ))}
          </div>
          {scene.snapshot.map((piece) => (
            <div
              key={piece.id}
              className="absolute grid place-items-center overflow-hidden rounded-sm border border-foreground bg-muted text-xs"
              style={{
                left: percent(piece.volume.x, bounds.w),
                top: percent(piece.volume.y, bounds.h),
                width: percent(piece.volume.w, bounds.w),
                height: percent(piece.volume.h, bounds.h),
                opacity: piece.id === scene.contactPieceId ? 1 - scene.contactFeedback * 0.2 : 1,
              }}
            >
              {piece.id}
            </div>
          ))}
        </div>
      </figure>
      <ul className="flex flex-wrap gap-inline-sm text-xs text-muted-foreground">
        {scene.snapshot.map((piece) => (
          <li key={piece.id}>
            {piece.id} · {volumeResponse(piece)} · x {piece.volume.x.toFixed(1)} · y{" "}
            {piece.volume.y.toFixed(1)} · z {piece.volume.z.toFixed(1)}–
            {(piece.volume.z + piece.volume.thickness).toFixed(1)}
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-inline-sm"
        onSubmit={(event) => {
          event.preventDefault();
          move();
        }}
      >
        {(["x", "y", "z", "w", "h", "thickness"] as const).map((field) => (
          <label key={field} className="flex flex-col gap-stack-xs text-xs">
            {field}
            <input
              className={`${control} w-20`}
              type="number"
              required
              step="any"
              value={Number.isNaN(target[field]) ? "" : target[field]}
              onChange={(event) => setTarget({ ...target, [field]: event.target.valueAsNumber })}
            />
          </label>
        ))}
        <label className="flex flex-col gap-stack-xs text-xs">
          Gutter
          <input
            className={`${control} w-20`}
            type="number"
            min={0}
            max={3}
            step={0.25}
            value={gutter}
            disabled={pending}
            onChange={(event) => {
              const value = event.target.valueAsNumber;

              if (Number.isFinite(value) && value >= 0 && value <= 3) reset(scenario, value);
            }}
          />
        </label>
        <button className={control} type="submit">
          Move B
        </button>
        <button
          className={control}
          type="button"
          disabled={pending}
          onClick={() => reset(scenario, gutter)}
        >
          Reset
        </button>
      </form>
      <form className="flex flex-wrap items-end gap-inline-sm" onSubmit={send}>
        <label className="flex min-w-0 flex-1 flex-col gap-stack-xs text-xs">
          Designer command
          <input
            className={control}
            maxLength={500}
            placeholder="Place C at x 4, y 2"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        <button className={control} type="submit" disabled={pending || !message.trim()}>
          {pending ? "Interpreting…" : "Send"}
        </button>
      </form>
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
    </section>
  );
}
