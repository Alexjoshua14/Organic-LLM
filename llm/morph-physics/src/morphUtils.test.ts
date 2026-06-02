import { describe, it, expect } from "vitest";
import {
  subtract,
  add,
  multiply,
  abs,
  magnitude,
  validateVector,
} from "./morphUtils";
import type { Vector4 } from "./schemas/physicsSchemas";

describe("Vector arithmetic", () => {
  describe("subtract", () => {
    it("should subtract two vectors component-wise", () => {
      const a: Vector4 = { x: 10, y: 20, w: 30, h: 40 };
      const b: Vector4 = { x: 5, y: 10, w: 15, h: 20 };

      const result = subtract(a, b);

      expect(result).toEqual({ x: 5, y: 10, w: 15, h: 20 });
    });

    it("should handle negative values", () => {
      const a: Vector4 = { x: 5, y: 10, w: 15, h: 20 };
      const b: Vector4 = { x: 10, y: 20, w: 30, h: 40 };

      const result = subtract(a, b);

      expect(result).toEqual({ x: -5, y: -10, w: -15, h: -20 });
    });

    it("should handle zero vector", () => {
      const a: Vector4 = { x: 10, y: 20, w: 30, h: 40 };
      const zero: Vector4 = { x: 0, y: 0, w: 0, h: 0 };

      const result = subtract(a, zero);

      expect(result).toEqual(a);
    });
  });

  describe("add", () => {
    it("should add two vectors component-wise", () => {
      const a: Vector4 = { x: 10, y: 20, w: 30, h: 40 };
      const b: Vector4 = { x: 5, y: 10, w: 15, h: 20 };

      const result = add(a, b);

      expect(result).toEqual({ x: 15, y: 30, w: 45, h: 60 });
    });

    it("should handle negative values", () => {
      const a: Vector4 = { x: 10, y: 20, w: 30, h: 40 };
      const b: Vector4 = { x: -5, y: -10, w: -15, h: -20 };

      const result = add(a, b);

      expect(result).toEqual({ x: 5, y: 10, w: 15, h: 20 });
    });

    it("should handle zero vector", () => {
      const a: Vector4 = { x: 10, y: 20, w: 30, h: 40 };
      const zero: Vector4 = { x: 0, y: 0, w: 0, h: 0 };

      const result = add(a, zero);

      expect(result).toEqual(a);
    });
  });

  describe("multiply", () => {
    it("should multiply vector by positive scalar", () => {
      const v: Vector4 = { x: 10, y: 20, w: 30, h: 40 };

      const result = multiply(v, 2);

      expect(result).toEqual({ x: 20, y: 40, w: 60, h: 80 });
    });

    it("should multiply vector by negative scalar", () => {
      const v: Vector4 = { x: 10, y: 20, w: 30, h: 40 };

      const result = multiply(v, -2);

      expect(result).toEqual({ x: -20, y: -40, w: -60, h: -80 });
    });

    it("should handle zero scalar", () => {
      const v: Vector4 = { x: 10, y: 20, w: 30, h: 40 };

      const result = multiply(v, 0);

      expect(result).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    });

    it("should handle fractional scalar", () => {
      const v: Vector4 = { x: 10, y: 20, w: 30, h: 40 };

      const result = multiply(v, 0.5);

      expect(result).toEqual({ x: 5, y: 10, w: 15, h: 20 });
    });
  });

  describe("abs", () => {
    it("should return absolute value of each component", () => {
      const v: Vector4 = { x: -10, y: 20, w: -30, h: 40 };

      const result = abs(v);

      expect(result).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    });

    it("should handle all positive values", () => {
      const v: Vector4 = { x: 10, y: 20, w: 30, h: 40 };

      const result = abs(v);

      expect(result).toEqual(v);
    });

    it("should handle all negative values", () => {
      const v: Vector4 = { x: -10, y: -20, w: -30, h: -40 };

      const result = abs(v);

      expect(result).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    });

    it("should handle zero", () => {
      const v: Vector4 = { x: 0, y: 0, w: 0, h: 0 };

      const result = abs(v);

      expect(result).toEqual(v);
    });
  });

  describe("magnitude", () => {
    it("should return sum of absolute values (L1 norm)", () => {
      const v: Vector4 = { x: 10, y: 20, w: 30, h: 40 };

      const result = magnitude(v);

      expect(result).toBe(100);
    });

    it("should handle negative values", () => {
      const v: Vector4 = { x: -10, y: -20, w: -30, h: -40 };

      const result = magnitude(v);

      expect(result).toBe(100);
    });

    it("should handle mixed positive and negative", () => {
      const v: Vector4 = { x: -10, y: 20, w: -30, h: 40 };

      const result = magnitude(v);

      expect(result).toBe(100);
    });

    it("should return zero for zero vector", () => {
      const v: Vector4 = { x: 0, y: 0, w: 0, h: 0 };

      const result = magnitude(v);

      expect(result).toBe(0);
    });
  });
});

describe("validateVector", () => {
  it("should return true for valid vector", () => {
    const v: Vector4 = { x: 10, y: 20, w: 30, h: 40 };

    expect(validateVector(v, "test")).toBe(true);
  });

  it("should return false for NaN in x", () => {
    const v: Vector4 = { x: NaN, y: 20, w: 30, h: 40 };

    expect(validateVector(v, "test")).toBe(false);
  });

  it("should return false for NaN in y", () => {
    const v: Vector4 = { x: 10, y: NaN, w: 30, h: 40 };

    expect(validateVector(v, "test")).toBe(false);
  });

  it("should return false for NaN in w", () => {
    const v: Vector4 = { x: 10, y: 20, w: NaN, h: 40 };

    expect(validateVector(v, "test")).toBe(false);
  });

  it("should return false for NaN in h", () => {
    const v: Vector4 = { x: 10, y: 20, w: 30, h: NaN };

    expect(validateVector(v, "test")).toBe(false);
  });

  it("should return false for Infinity", () => {
    const v: Vector4 = { x: Infinity, y: 20, w: 30, h: 40 };

    expect(validateVector(v, "test")).toBe(false);
  });

  it("should return false for -Infinity", () => {
    const v: Vector4 = { x: 10, y: -Infinity, w: 30, h: 40 };

    expect(validateVector(v, "test")).toBe(false);
  });

  it("should handle zero values", () => {
    const v: Vector4 = { x: 0, y: 0, w: 0, h: 0 };

    expect(validateVector(v, "test")).toBe(true);
  });

  it("should handle negative values", () => {
    const v: Vector4 = { x: -10, y: -20, w: -30, h: -40 };

    expect(validateVector(v, "test")).toBe(true);
  });

  it("should handle decimal values", () => {
    const v: Vector4 = { x: 10.5, y: 20.7, w: 30.3, h: 40.9 };

    expect(validateVector(v, "test")).toBe(true);
  });
});
