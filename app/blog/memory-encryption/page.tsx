import { BlogArticleShell } from "@/components/blog/blog-article-shell";
import { MemoryEncryptionDesignSpace } from "@/components/blog/memory-encryption-design-space";
import { MEMORY_ENCRYPTION_DESIGN_SPACE } from "@/content/blog/memory-encryption-design-space";
import { MemoryEncryptionIntroContent } from "@/content/blog/memory-encryption-intro-content";
import { MemoryEncryptionOutroContent } from "@/content/blog/memory-encryption-outro-content";

export default function MemoryEncryptionPostPage() {
  return (
    <BlogArticleShell slug="memory-encryption">
      <MemoryEncryptionIntroContent />
      <MemoryEncryptionDesignSpace sections={MEMORY_ENCRYPTION_DESIGN_SPACE} />
      <MemoryEncryptionOutroContent />
    </BlogArticleShell>
  );
}
