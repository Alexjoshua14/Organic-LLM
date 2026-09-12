import { tool } from "ai";
import { z } from "zod";

import { createLogger } from "@/lib/logger";
import { gatherRestaurant } from "@/lib/restaurant/gather-restaurant";

const logger = createLogger("lib/llm/restaurant-tool.ts");

export const GATHER_RESTAURANT_TOOL_NAME = "gather_restaurant";

const GatherRestaurantInputSchema = z.object({
  name: z.string().min(1).describe("Restaurant name"),
  city: z.string().optional().describe("City or neighborhood when known"),
  lat: z.number().optional().describe("Latitude for location bias"),
  lng: z.number().optional().describe("Longitude for location bias"),
});

export function createGatherRestaurantTool({ sbUserId }: { sbUserId: string }) {
  return tool({
    description:
      "Fetch verified restaurant data (Google Places) and return a restaurant-card block. Use when the user wants a restaurant card with hours, photos, ratings, and links. Resolve city from memories or chat context first; if search is ambiguous, ask the user which location they mean. On success, pass the returned block to render_gen_ui — do not invent factual fields.",
    inputSchema: GatherRestaurantInputSchema,
    execute: async (input) => {
      const result = await gatherRestaurant(sbUserId, input);

      if (result.status === "ambiguous") {
        logger.log("gather_restaurant", "ambiguous venue", {
          event: "restaurant_ambiguous",
          candidateCount: result.candidates.length,
        });
      } else if (result.status === "resolved") {
        logger.log("gather_restaurant", "resolved venue", {
          event: "restaurant_resolved",
          name: result.block.name,
        });
      } else {
        logger.log("gather_restaurant", "gather failed", {
          event: "restaurant_error",
          error: result.error,
        });
      }

      return result;
    },
  });
}
