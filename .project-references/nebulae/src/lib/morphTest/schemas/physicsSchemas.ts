import z from "zod";

export const vector4 = z.object({
  x: z.number().describe("Horizontal position (x)"),
  y: z.number().describe("Vertical position (y)"),
  w: z.number().describe("Width"),
  h: z.number().describe("Height"),
});

export type Vector4 = z.infer<typeof vector4>;
