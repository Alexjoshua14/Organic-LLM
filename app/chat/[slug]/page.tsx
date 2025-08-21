import Page from "@/components/page";
import { Chat } from "@/components/chat/chat";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: chatId } = await params;

  const id = chatId;

  return (
    <Page>
      <Chat chatId={id} />
    </Page>
  );
}

// <div className="h-full flex flex-col overflow-hidden items-center">
//   {/*<div className="absolute top-0 w-full inline-block text-center justify-center p-4 bg-white/5 backdrop-blur-xl shadow">
//     <span className={title()}>Welcome Chat ;)</span>
//     <span className={subtitle()}>Chat ID: {chatId}</span>
//   </div>*/}
//   <div className="h-full">
//     <ChatThread id={id} />
//   </div>
//   <ChatInput id={id} />
// </div>
