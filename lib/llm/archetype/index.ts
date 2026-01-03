import { tool } from "ai";
import z from "zod";

/**
 * Set the state of the archetype
 */
export const setArchetypeStateTool = tool({
  description: "Ask the client to open or close the archetype",
  inputSchema: z.object({
    open: z.boolean().describe("Whether to open the archetype"),
  }),
});

/**
 * View the currently opened Archetype
 */
export const viewArchetypeTool = tool({
  description: "Ask the client for the currently opened Archetype",
  inputSchema: z.object({}),
});
