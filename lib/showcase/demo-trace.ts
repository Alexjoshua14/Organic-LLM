import type { ShowcaseTrace } from "./showcase-trace";

import raw from "./demo-trace.json";

/** Hand-authored static trace bundled at build time (no runtime fetch). */
export const demoTrace = raw as unknown as ShowcaseTrace;
