import { z } from "zod";

export const NewsArchetype = z.object({
  id: z.string(),
  kind: z.literal("news"),
  title: z.string(),
  summary: z.string(),
  content: z.json(),
});

export const ChatPayload = z.object({
  kind: z.literal("chat"),
  id: z.string(),
});

export const ArchetypePayload = z.discriminatedUnion("kind", [
  ChatPayload,
  NewsArchetype,
]);

export type ArchetypePayload = z.infer<typeof ArchetypePayload>;
export type ArchetypePayloadT = z.infer<typeof ArchetypePayload>;
export type Archetype = ArchetypePayload["kind"];

export type UIIntent = {
  id: string;
  archetype: Archetype;
  confidence: number;
  data: ArchetypePayloadT;
};
