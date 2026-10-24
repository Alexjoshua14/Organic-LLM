import { ChatMessageFlowContent } from "@/content/blog/chat-message-flow-content";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { blogArticlePage } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

export default function ChatMessageFlowPostPage() {
  return (
    <PageContentFrame maxWidth="2xl">
      <PageNavBack className={blogArticlePage.navToContent} href="/blog">
        ← Blog
      </PageNavBack>
      <article className={cn("p-6 sm:p-8 text-foreground", blogArticlePage.blockStack)}>
        <ChatMessageFlowContent />
      </article>
    </PageContentFrame>
  );
}
