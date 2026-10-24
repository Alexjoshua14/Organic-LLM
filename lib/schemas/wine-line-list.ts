import { z } from "zod";

/** Single row in the wine line list. */
export const WineEntrySchema = z.object({
  id: z.string().optional(),
  wine: z.string(),
  style: z.string(),
  keyFoodAffinities: z.string(),
  category: z.enum(["red", "white", "orange"]).optional(),
  attributes: z.array(z.string()).optional(),
});

export type WineEntry = z.infer<typeof WineEntrySchema>;

/** Custom UIMessage part for the wine line list (stream + stored). */
export const WineLineListPartSchema = z.object({
  type: z.literal("data-wineLineList"),
  data: z.object({
    wines: z.array(WineEntrySchema),
  }),
});

export type WineLineListPart = z.infer<typeof WineLineListPartSchema>;

export function isWineLineListPart(part: {
  type: string;
  data?: unknown;
}): part is WineLineListPart {
  return part.type === "data-wineLineList" && part.data != null && "wines" in (part.data as object);
}

/** Extract wines from an assistant message that has a data-wineLineList part. */
export function getWinesFromMessage(
  parts: Array<{ type: string; data?: { wines?: WineEntry[] } }>
): WineEntry[] {
  const part = parts.find((p) => p.type === "data-wineLineList" && p.data?.wines);

  return part?.data?.wines ?? [];
}

/** Build a minimal UIMessage for persisting the wine list (e.g. after merge). */
export function buildWineListMessage(
  messageId: string,
  wines: WineEntry[]
): { id: string; role: "assistant"; parts: WineLineListPart[] } {
  return {
    id: messageId,
    role: "assistant",
    parts: [{ type: "data-wineLineList", data: { wines } }],
  };
}
