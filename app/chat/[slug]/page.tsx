import { ChatInput } from "@/components/chat/chat-input";
import Page from "@/components/page";
import { title, subtitle, page } from "@/components/primitives";

export default async function Chat({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: chatId } = await params;

  return (
    <Page>
      <div className="inline-block max-w-xl text-center justify-center">
        <span className={title()}>Welcome Chat ;)</span>
        <span className={subtitle()}>Chat ID: {chatId}</span>
      </div>
      <ChatInput />
    </Page>
  );
}
