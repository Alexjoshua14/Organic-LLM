import { describe, it, expect } from "vitest";
import { snapshot, clearInlineStyles } from "./morphUtils";
import { mockBoundingRect } from "./test/helpers";

describe("snapshot", () => {
  it("subtracts container rect when container provided", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);

    mockBoundingRect(parent, { x: 100, y: 200, width: 600, height: 400 });
    mockBoundingRect(child, { x: 130, y: 265, width: 90, height: 40 });

    expect(snapshot(child, parent)).toEqual({
      x: 30,
      y: 65,
      w: 90,
      h: 40,
    });
  });

  it("uses viewport rect when no container", () => {
    const el = document.createElement("div");
    mockBoundingRect(el, { x: -5, y: 12, width: 200, height: 150 });
    expect(snapshot(el)).toEqual({ x: -5, y: 12, w: 200, h: 150 });
  });
});

describe("clearInlineStyles", () => {
  it("clears transform width height", () => {
    const el = document.createElement("div");
    el.style.transform = "translate(1px, 2px)";
    el.style.width = "10px";
    el.style.height = "20px";

    clearInlineStyles(el);

    expect(el.style.transform).toBe("");
    expect(el.style.width).toBe("");
    expect(el.style.height).toBe("");
  });
});
