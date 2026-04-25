import Link from "next/link";

import { ChatMessageFlowContent } from "@/content/blog/chat-message-flow-content";
import { blogArticlePage } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

export default function ChatMessageFlowPostPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <nav className={blogArticlePage.navToContent}>
        <Link className="text-sm text-foreground hover:underline" href="/blog">
          ← Blog
        </Link>
      </nav>
      <article className={cn("p-6 sm:p-8 text-foreground", blogArticlePage.blockStack)}>
        <ChatMessageFlowContent />
      </article>
    </div>
  );
}
