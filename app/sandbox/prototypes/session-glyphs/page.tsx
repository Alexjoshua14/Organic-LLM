import type { Metadata } from "next";

import { SessionGlyphLab } from "./_components/session-glyph-lab";

import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Session glyphs"),
};

export default function SessionGlyphsPrototypePage() {
  return <SessionGlyphLab />;
}
