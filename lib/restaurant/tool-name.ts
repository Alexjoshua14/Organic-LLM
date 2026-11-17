/**
 * Name of the restaurant-lookup tool. Lives in its own import-free module so client components
 * can match on it: `lib/llm/restaurant-tool.ts` reaches server-only code (Google Places), and
 * importing it from the browser bundle breaks the production build.
 */
export const GATHER_RESTAURANT_TOOL_NAME = "gather_restaurant";
