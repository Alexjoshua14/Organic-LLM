import Link from "next/link";

import { HowWeSecureMemoryContent } from "@/content/blog/how-we-secure-memory-content";

export default function HowWeSecureMemoryPostPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <nav className="mb-8">
        <Link className="text-sm text-foreground hover:underline" href="/blog">
          ← Blog
        </Link>
      </nav>
      <article className="p-6 sm:p-8 text-foreground space-y-10">
        <HowWeSecureMemoryContent />
      </article>
    </div>
  );
}
