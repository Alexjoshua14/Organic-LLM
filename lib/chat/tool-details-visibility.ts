/**
 * Raw tool payloads ("Tool details") are a development and debugging aid, not product UI.
 * Gen-ui tool components show them only in a local dev instance; previews and production
 * (both `NODE_ENV=production`) never do. Components take an override prop so tests can
 * render either branch.
 */
export const SHOW_TOOL_DETAILS = process.env.NODE_ENV === "development";
