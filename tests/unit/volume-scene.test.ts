import { describe, expect, test } from "bun:test";
import { VolumeScene, volumeContact, volumeResponse } from "../../llm/morph-physics/src";
import { applyCommand, createDemoScene, square } from "../../app/sandbox/prototypes/volume-morphs/scene";

describe("volume scene", () => {
  test("equal peers split the gutter before touching", () => {
    const scene = createDemoScene("Equal peers", 0.5);
    expect(scene.move("B", square(8.5, 6))).toBe("moving");
    scene.step(16);
    expect(scene.snapshot[0].volume.x).toBeGreaterThan(8.5);
    scene.step(0, true);
    expect(scene.snapshot.map(({ volume }) => volume.x)).toEqual([10.25, 6.75]);
  });

  test("fixed obstacles stop a sweeping move at the near face even if the target is beyond them", () => {
    const scene = createDemoScene("Fixed blockage", 0.5);
    expect(scene.move("B", square(16, 6))).toBe("blocked");
    for (let i = 0; i < 100 && !scene.contactFeedback; i++) scene.step(16);
    expect(scene.snapshot.map(({ volume }) => volume.x)).toEqual([8.5, 5]);
    expect(scene.contactPieceId).toBe("B");
    scene.step(180);
    expect(scene.active).toBe(false);
  });

  test("separate depth intervals clear in either direction", () => {
    const stationary = square(8.5, 6, 2);
    for (const depth of [1, 3]) {
      expect(volumeContact(square(0, 6, depth), square(16, 6, depth), stationary, stationary, 0.5)).toBe(1);
    }
    const scene = createDemoScene("Depth clearance", 0.5);
    expect(scene.move("B", square(8.5, 6, 2))).toBe("moving");
    scene.step(0, true);
    expect(scene.snapshot[1].volume).toEqual(square(8.5, 6, 2));
  });

  test("resizing and retargeting respect swept bounds", () => {
    const scene = new VolumeScene({ w: 20, h: 15, thickness: 6 });
    scene.place({ id: "A", volume: square(0, 0), origin: "auto" });
    expect(scene.move("A", square(10, 0))).toBe("moving");
    scene.step(16);
    const current = scene.snapshot[0].volume;
    expect(scene.move("A", { ...square(10, 0), w: 14 })).toBe("blocked");
    expect(scene.snapshot[0].volume).toEqual(current);
    scene.step(16);
    expect(scene.snapshot[0].volume.x).toBeGreaterThan(current.x);
    scene.step(0, true);
    const { x, w } = scene.snapshot[0].volume;
    expect(x + w).toBeCloseTo(20);
  });

  test("designer placements are fixed and cannot enter a reserved path", () => {
    const scene = createDemoScene("Depth clearance", 0);
    scene.move("B", square(8.5, 6, 2));
    const command = { action: "place", id: "C", x: 4, y: 6, z: 2, w: null, h: null, thickness: null } as const;
    expect(applyCommand(scene, command)).toContain("free space");
    expect(applyCommand(scene, { ...command, x: 19 })).toContain("free space");
    expect(applyCommand(scene, { ...command, y: 0 })).toBe("Placed C.");
    expect(volumeResponse(scene.snapshot[2])).toBe("fixed");
  });
});
