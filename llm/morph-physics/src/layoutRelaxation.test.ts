import { describe, it, expect } from "vitest";

import { suggestLayoutConstraintRelaxation } from "./layoutRelaxation";

describe("suggestLayoutConstraintRelaxation", () => {
  const base = { x: 0, y: 0, w: 100, h: 50 };

  it("returns false when current fits target dimensions within epsilon", () => {
    expect(
      suggestLayoutConstraintRelaxation(
        { ...base, w: 100, h: 50 },
        { ...base, w: 100, h: 50 },
        { epsilon: 1 }
      )
    ).toEqual({ width: false, height: false });
  });

  it("relaxWidth when current is wider than target beyond epsilon", () => {
    expect(
      suggestLayoutConstraintRelaxation(
        { ...base, w: 200, h: 50 },
        { ...base, w: 100, h: 50 },
        { epsilon: 1 }
      )
    ).toEqual({ width: true, height: false });
  });

  it("relaxHeight when current is taller than target beyond epsilon", () => {
    expect(
      suggestLayoutConstraintRelaxation(
        { ...base, w: 100, h: 80 },
        { ...base, w: 100, h: 50 },
        { epsilon: 1 }
      )
    ).toEqual({ width: false, height: true });
  });

  it("returns false on both when expanding (current smaller than target)", () => {
    expect(
      suggestLayoutConstraintRelaxation(
        { ...base, w: 80, h: 40 },
        { ...base, w: 200, h: 100 },
        { epsilon: 1 }
      )
    ).toEqual({ width: false, height: false });
  });

  it("respects epsilon boundary on width", () => {
    expect(
      suggestLayoutConstraintRelaxation(
        { ...base, w: 100.4, h: 50 },
        { ...base, w: 100, h: 50 },
        { epsilon: 0.5 }
      )
    ).toEqual({ width: false, height: false });
    expect(
      suggestLayoutConstraintRelaxation(
        { ...base, w: 100.6, h: 50 },
        { ...base, w: 100, h: 50 },
        { epsilon: 0.5 }
      )
    ).toEqual({ width: true, height: false });
  });

  it("uses default epsilon 0.5 when options omitted", () => {
    expect(
      suggestLayoutConstraintRelaxation({ ...base, w: 100.6, h: 50 }, { ...base, w: 100, h: 50 })
    ).toEqual({ width: true, height: false });
  });
});
