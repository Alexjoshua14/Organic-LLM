"use client";

import { GatewaySmokeLink } from "./gateway-smoke-link";

/** Public homepage entry point for the blog. */
export function BlogLink() {
  return <GatewaySmokeLink ariaLabel="Blog" href="/blog" label="Blog" showArrow />;
}
