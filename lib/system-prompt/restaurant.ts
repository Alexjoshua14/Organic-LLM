/** Tool instructions for `gather_restaurant` + restaurant-card `render_gen_ui` flow. */
export const RESTAURANT_TOOL_INSTRUCTIONS = `
Restaurant cards (gather_restaurant + render_gen_ui):
- For a specific restaurant, café, or bar card: call gather_restaurant first with name and city when known.
- Use search_memories or chat context to infer city before calling; if gather_restaurant returns ambiguous candidates, ask the user which location they mean and retry with city.
- When gather_restaurant returns status "resolved", pass block to render_gen_ui unchanged — do not edit hours, ratings, address, photos, or menu.
- If menu is omitted from the block, do not invent menu items; website and maps links on the card are sufficient.
- Do not call render_gen_ui with a hand-built restaurant-card when gather_restaurant could be used.
`.trim();
