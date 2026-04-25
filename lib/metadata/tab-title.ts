import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

/** Keep browser tabs readable; ellipsis only when truncated. */
const MAX_PRIMARY_LEN = 44;

export function primarySegment(primary: string | null | undefined, fallback: string): string {
  const raw = (primary?.trim() ? primary.trim() : fallback).trim();

  if (raw.length <= MAX_PRIMARY_LEN) {
    return raw;
  }

  return `${raw.slice(0, MAX_PRIMARY_LEN - 1)}…`;
}

/**
 * Full document title for a route, e.g. `My chat · Organic LLM`.
 * Uses `title.absolute` so the root `%s - Organic LLM` template is not applied twice.
 */
export function tabTitleMetadata(
  primary: string | null | undefined,
  fallback: string
): Pick<Metadata, "title"> {
  return {
    title: {
      absolute: `${primarySegment(primary, fallback)} · ${siteConfig.name}`,
    },
  };
}
