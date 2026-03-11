import Link from "next/link";
import { ChatMessageFlowContent } from "@/content/blog/chat-message-flow-content";

export default function ChatMessageFlowPostPage() {
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
        <ChatMessageFlowContent />
      </article>
    </div>
  );
}
