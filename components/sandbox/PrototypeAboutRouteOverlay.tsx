"use client";

import { usePathname } from "next/navigation";

import { extractPrototypeSlugFromPath } from "@/app/sandbox/prototypes/_config/prototypes";
import { PrototypeAboutPanel } from "@/components/sandbox/PrototypeAboutPanel";

/** Renders the floating About panel on any /sandbox/prototypes/* route. */
export function PrototypeAboutRouteOverlay() {
  const pathname = usePathname();
  const slug = extractPrototypeSlugFromPath(pathname ?? "");

  if (!slug) return null;

  return <PrototypeAboutPanel slug={slug} />;
}
