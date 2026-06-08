import Link from "next/link";

import { MemoryEncryptionDesignSpace } from "@/components/blog/memory-encryption-design-space";
import { blogArticlePage } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";
import { MEMORY_ENCRYPTION_DESIGN_SPACE } from "@/content/blog/memory-encryption-design-space";
import { MemoryEncryptionIntroContent } from "@/content/blog/memory-encryption-intro-content";
import { MemoryEncryptionOutroContent } from "@/content/blog/memory-encryption-outro-content";

export default function MemoryEncryptionPostPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <nav className={blogArticlePage.navToContent}>
        <Link className="text-sm text-foreground hover:underline" href="/blog">
          ← Blog
        </Link>
      </nav>
      <article className={cn("p-6 sm:p-8 text-foreground", blogArticlePage.blockStack)}>
        <MemoryEncryptionIntroContent />
        <MemoryEncryptionDesignSpace sections={MEMORY_ENCRYPTION_DESIGN_SPACE} />
        <MemoryEncryptionOutroContent />
      </article>
    </div>
  );
}
