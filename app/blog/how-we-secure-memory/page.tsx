import { HowWeSecureMemoryContent } from "@/content/blog/how-we-secure-memory-content";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";

export default function HowWeSecureMemoryPostPage() {
  return (
    <PageContentFrame maxWidth="2xl">
      <PageNavBack href="/blog">← Blog</PageNavBack>
      <article className="p-6 sm:p-8 text-foreground space-y-10">
        <HowWeSecureMemoryContent />
      </article>
    </PageContentFrame>
  );
}
