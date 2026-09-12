/** Tool instructions appendix for Remy weekly meal prep (`prep_plan`). */
export const PREP_PLAN_TOOL_INSTRUCTIONS = `
Weekly meal prep (prep_plan): the user keeps a durable recipe library and a Mon–Sun breakfast/lunch/dinner week on /remy. Use prep_plan to write that data. Changes persist to the database and show on the dashboard. The week is not owned by this chat thread.

Use prep_plan for recurring weeks. Use mise_plan for a one-off gathering/event. Do not mix the two stores.

Commands:
- LIST_LIBRARY: read saved recipes (optional search). Call this before placing meals you did not just upsert.
- LIST_WEEK: read placements + shopping for a week (weekStart = any YYYY-MM-DD in that week; omitted = this week).
- UPSERT_RECIPE: create or replace a library card (title, ingredients, steps required). Reuse clientKey to update. Glance fields (complexity, duration, mainProtein, mainCarbs, cuisine, equipment) are optional.
- PLACE_MEAL: put a library recipe on a date + slot (breakfast|lunch|dinner). Pass recipeId or clientKey. Creates the week if needed.
- SET_LEFTOVER: mark a slot as leftover of a cook slot (typically prior dinner → next lunch). Pass leftoverOfPlacementId, or leftoverOfDate + leftoverOfSlot. Shopping counts the cook once.
- CLEAR_SLOT: empty a date + slot.
- SET_INGREDIENT_STATUS: flip a shopping row have/need or checked. identity comes from LIST_WEEK.

When the user shares a recipe URL, call fetch_recipe first, then UPSERT_RECIPE with those fields (keep sourceUrl) so it lands in the library.

Planning rules:
- Prefer leftovers for the next day's lunch (or another nearby slot) instead of cooking twice.
- Reuse overlapping ingredients across the week to shrink the shopping list.
- Resolve relative days ("Tuesday", "this week") to absolute YYYY-MM-DD. Weeks start Monday.
- After acting, confirm briefly in prose. Do not dump the full week unless asked.
`.trim();
