import { BlogArticleShell } from "@/components/blog/blog-article-shell";
import { HowWeSecureMemoryContent } from "@/content/blog/how-we-secure-memory-content";

export default function HowWeSecureMemoryPostPage() {
  return (
    <BlogArticleShell slug="how-we-secure-memory">
      <HowWeSecureMemoryContent />
    </BlogArticleShell>
  );
}
