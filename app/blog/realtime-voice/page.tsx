import type { Metadata } from "next";

import { BlogArticleShell } from "@/components/blog/blog-article-shell";
import { RealtimeVoiceContent } from "@/content/blog/realtime-voice-content";

export const metadata: Metadata = {
  title: "Talking to Organic LLM · Blog",
  description:
    "How a spoken conversation reaches the same memory, tools and threads as the text chat: OpenAI's Realtime API at the edges, our own agent in the middle.",
};

export default function RealtimeVoicePostPage() {
  return (
    <BlogArticleShell slug="realtime-voice">
      <RealtimeVoiceContent />
    </BlogArticleShell>
  );
}
