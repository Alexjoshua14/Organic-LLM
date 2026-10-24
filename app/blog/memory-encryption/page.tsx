import { MemoryEncryptionDesignSpace } from "@/components/blog/memory-encryption-design-space";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { blogArticlePage } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";
import { MEMORY_ENCRYPTION_DESIGN_SPACE } from "@/content/blog/memory-encryption-design-space";
import { MemoryEncryptionIntroContent } from "@/content/blog/memory-encryption-intro-content";
import { MemoryEncryptionOutroContent } from "@/content/blog/memory-encryption-outro-content";

export default function MemoryEncryptionPostPage() {
  return (
    <PageContentFrame maxWidth="2xl">
      <PageNavBack className={blogArticlePage.navToContent} href="/blog">
        ← Blog
      </PageNavBack>
      <article className={cn("p-6 sm:p-8 text-foreground", blogArticlePage.blockStack)}>
        <MemoryEncryptionIntroContent />
        <MemoryEncryptionDesignSpace sections={MEMORY_ENCRYPTION_DESIGN_SPACE} />
        <MemoryEncryptionOutroContent />
      </article>
    </PageContentFrame>
  );
}
