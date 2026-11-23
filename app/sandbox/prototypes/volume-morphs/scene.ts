import { VolumeScene, type Volume } from "@organic-llm/morph-physics";
import { z } from "zod";

export const bounds = { w: 20, h: 15, thickness: 6 };
export const scenarios = ["Equal peers", "Fixed blockage", "Depth clearance"] as const;
export type Scenario = (typeof scenarios)[number];

export const commandSchema = z.object({
  action: z.enum(["place", "move", "unsupported"]),
  id: z.string().trim().min(1).max(24).nullable(),
  x: z.number().min(0).max(bounds.w).nullable(),
  y: z.number().min(0).max(bounds.h).nullable(),
  z: z.number().min(0).max(bounds.thickness).nullable(),
  w: z.number().positive().max(bounds.w).nullable(),
  h: z.number().positive().max(bounds.h).nullable(),
  thickness: z.number().positive().max(bounds.thickness).nullable(),
});

export function square(x: number, y: number, z = 0): Volume {
  return { x, y, z, w: 3, h: 3, thickness: 1 };
}

export function createDemoScene(scenario: Scenario, gutter: number) {
  const scene = new VolumeScene(bounds, gutter);

  scene.place({
    id: "A",
    volume: square(8.5, 6),
    origin: "auto",
    response: scenario === "Equal peers" ? "yielding" : "fixed",
  });
  scene.place({
    id: "B",
    volume: square(0, 6, scenario === "Depth clearance" ? 2 : 0),
    origin: "auto",
  });

  return scene;
}

export function applyCommand(scene: VolumeScene, command: z.infer<typeof commandSchema>) {
  const { action, id, x, y } = command;

  if (action === "unsupported" || x === null || y === null)
    return "Specify a placement or move with x and y.";
  const existing = scene.snapshot.find((piece) => piece.id === id);

  if (action === "move" && !existing) return "Name an existing piece to move.";
  const base = action === "move" && existing ? existing.volume : square(x, y);
  const volume = {
    x,
    y,
    z: command.z ?? base.z,
    w: command.w ?? base.w,
    h: command.h ?? base.h,
    thickness: command.thickness ?? base.thickness,
  };

  if (action === "move" && existing) {
    const result = scene.move(existing.id, volume);

    return result === "moving"
      ? `Moving ${existing.id}.`
      : result === "blocked"
        ? `${existing.id} will stop at first contact.`
        : "Invalid move.";
  }
  const name = id ?? `Piece ${scene.snapshot.length + 1}`;

  if (scene.snapshot.length >= 24) return "The demo supports up to 24 pieces.";

  return scene.place({ id: name, volume, origin: "user" })
    ? `Placed ${name}.`
    : "Placement needs a unique name and free space within the bounds.";
}
