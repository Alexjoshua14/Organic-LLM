import fs from "node:fs";
import path from "node:path";

import { getDevDocBySlug } from "./registry";

const CONTENT_DIR = path.join(process.cwd(), "content/dev-docs");

export function loadDevDocMarkdown(slug: string): string {
  const entry = getDevDocBySlug(slug);

  if (!entry) {
    throw new Error(`Unknown dev doc slug: ${slug}`);
  }

  const filePath = path.join(CONTENT_DIR, entry.file);

  return fs.readFileSync(filePath, "utf8");
}
