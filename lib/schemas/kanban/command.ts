import { z } from "zod";

import { KanbanItemPatchSchema, KanbanItemSchema, KanbanStatusSchema } from "./item";
import { KANBAN_CAPS, KANBAN_VERSION } from "./shared";
import { KanbanViewSchema } from "./view";

/** Create (or replace) the board and optionally seed it. Mounts the loading shell. */
export const InitiateKanbanCommandSchema = z.object({
  type: z.literal("INITIATE_KANBAN"),
  version: KANBAN_VERSION,
  board: z.object({
    id: z.string().min(1).max(120).optional(),
    title: z.string().min(1).max(KANBAN_CAPS.boardTitle),
    description: z.string().max(KANBAN_CAPS.boardDescription).optional(),
  }),
  seedItems: z.array(KanbanItemSchema).max(KANBAN_CAPS.seedItems).optional(),
});

/** Insert or update a batch of items (matched by id). Marks the board ready. */
export const UpsertItemsCommandSchema = z.object({
  type: z.literal("UPSERT_ITEMS"),
  version: KANBAN_VERSION,
  items: z.array(KanbanItemSchema).min(1).max(KANBAN_CAPS.itemsPerUpsert),
});

/** Patch a single existing item. */
export const UpdateItemCommandSchema = z.object({
  type: z.literal("UPDATE_ITEM"),
  version: KANBAN_VERSION,
  id: z.string().min(1).max(120),
  patch: KanbanItemPatchSchema,
});

/** Move an item to a new column (and optional manual order). */
export const MoveItemCommandSchema = z.object({
  type: z.literal("MOVE_ITEM"),
  version: KANBAN_VERSION,
  id: z.string().min(1).max(120),
  status: KanbanStatusSchema,
  order: z.number().optional(),
});

/** Remove an item from the board. */
export const RemoveItemCommandSchema = z.object({
  type: z.literal("REMOVE_ITEM"),
  version: KANBAN_VERSION,
  id: z.string().min(1).max(120),
});

/** Present a saved view to the user (anchored in the thread). */
export const ShowViewCommandSchema = z.object({
  type: z.literal("SHOW_VIEW"),
  version: KANBAN_VERSION,
  view: KanbanViewSchema,
});

export const KanbanCommandSchema = z.discriminatedUnion("type", [
  InitiateKanbanCommandSchema,
  UpsertItemsCommandSchema,
  UpdateItemCommandSchema,
  MoveItemCommandSchema,
  RemoveItemCommandSchema,
  ShowViewCommandSchema,
]);

export type KanbanCommand = z.infer<typeof KanbanCommandSchema>;
export type InitiateKanbanCommand = z.infer<typeof InitiateKanbanCommandSchema>;
export type UpsertItemsCommand = z.infer<typeof UpsertItemsCommandSchema>;
export type ShowViewCommand = z.infer<typeof ShowViewCommandSchema>;
