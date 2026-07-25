/** App semver from package.json, injected at build via next.config.js. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

export const APP_VERSION_LABEL = `v${APP_VERSION}`;
