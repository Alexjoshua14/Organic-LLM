import { BlogArticleShell } from "@/components/blog/blog-article-shell";
import { ChatMessageFlowContent } from "@/content/blog/chat-message-flow-content";

export default function ChatMessageFlowPostPage() {
  return (
    <BlogArticleShell slug="chat-message-flow">
      <ChatMessageFlowContent />
    </BlogArticleShell>
  );
}
