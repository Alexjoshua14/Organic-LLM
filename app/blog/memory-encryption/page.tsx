import fs from "fs";
import path from "path";
import Link from "next/link";
import { BlogProse } from "@/components/blog/blog-prose";
import { MemoryEncryptionDesignSpace } from "@/components/blog/memory-encryption-design-space";
import { MEMORY_ENCRYPTION_DESIGN_SPACE } from "@/content/blog/memory-encryption-design-space";

const INTRO_PATH = path.join(
  process.cwd(),
  "content/blog/memory-encryption-intro.md",
);
const OUTRO_PATH = path.join(
  process.cwd(),
  "content/blog/memory-encryption-outro.md",
);

function getIntro(): string {
  try {
    return fs.readFileSync(INTRO_PATH, "utf-8");
  } catch {
    return "# Memory Encryption\n\nContent could not be loaded.";
  }
}

function getOutro(): string {
  try {
    return fs.readFileSync(OUTRO_PATH, "utf-8");
  } catch {
    return "";
  }
}

export default function MemoryEncryptionPostPage() {
  const intro = getIntro();
  const outro = getOutro();

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <nav className="mb-8">
        <Link
          href="/blog"
          className="text-sm text-foreground hover:underline"
        >
          ← Blog
        </Link>
      </nav>
      <article className="p-6 sm:p-8 text-foreground space-y-10">
        <BlogProse content={intro} />
        <MemoryEncryptionDesignSpace sections={MEMORY_ENCRYPTION_DESIGN_SPACE} />
        <BlogProse content={outro} />
      </article>
    </div>
  );
}
