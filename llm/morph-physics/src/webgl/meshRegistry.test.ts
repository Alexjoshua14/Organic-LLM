import { describe, it, expect, beforeEach } from "vitest";
import { MeshRegistry } from "./registry";
import type { Vector4 } from "../schemas/physicsSchemas";

describe("MeshRegistry", () => {
  let registry: MeshRegistry;
  const rect: Vector4 = { x: 1, y: 2, w: 100, h: 80 };

  beforeEach(() => {
    registry = new MeshRegistry();
  });

  it("register and get round-trip", () => {
    registry.register("a", rect, { kind: "hud" });
    const m = registry.get("a");
    expect(m?.id).toBe("a");
    expect(m?.rect).toEqual(rect);
    expect(m?.metadata).toEqual({ kind: "hud" });
  });

  it("update mutates rect", () => {
    registry.register("a", rect);
    const next: Vector4 = { x: 5, y: 5, w: 50, h: 50 };
    registry.update("a", next);
    expect(registry.get("a")?.rect).toEqual(next);
  });

  it("update throws when mesh missing", () => {
    expect(() => registry.update("missing", rect)).toThrow("Mesh does not exist");
  });

  it("unregister removes mesh", () => {
    registry.register("a", rect);
    registry.unregister("a");
    expect(registry.get("a")).toBeUndefined();
    expect(registry.has("a")).toBe(false);
  });

  it("size and clear", () => {
    expect(registry.size()).toBe(0);
    registry.register("a", rect);
    registry.register("b", rect);
    expect(registry.size()).toBe(2);
    registry.clear();
    expect(registry.size()).toBe(0);
  });

  it("getAll returns the internal map", () => {
    registry.register("a", rect);
    expect(registry.getAll().size).toBe(1);
  });
});
