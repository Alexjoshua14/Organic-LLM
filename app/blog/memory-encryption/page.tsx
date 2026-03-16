import Link from "next/link";

import { MemoryEncryptionDesignSpace } from "@/components/blog/memory-encryption-design-space";
import { MEMORY_ENCRYPTION_DESIGN_SPACE } from "@/content/blog/memory-encryption-design-space";
import { MemoryEncryptionIntroContent } from "@/content/blog/memory-encryption-intro-content";
import { MemoryEncryptionOutroContent } from "@/content/blog/memory-encryption-outro-content";

export default function MemoryEncryptionPostPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <nav className="mb-8">
        <Link className="text-sm text-foreground hover:underline" href="/blog">
          ← Blog
        </Link>
      </nav>
      <article className="p-6 sm:p-8 text-foreground space-y-10">
        <MemoryEncryptionIntroContent />
        <MemoryEncryptionDesignSpace sections={MEMORY_ENCRYPTION_DESIGN_SPACE} />
        <MemoryEncryptionOutroContent />
      </article>
    </div>
  );
}
