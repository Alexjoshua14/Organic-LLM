import Page from "@/components/page";
import { Chat } from "@/components/chat/chat";
import { createChat, loadChat } from "@/util/chat-store";
import { redirect } from "next/navigation";
import { UIMessage } from "ai";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: chatId } = await params;

  const id = chatId;

  let messages: UIMessage[] = [];

  try {
    messages = await loadChat(id).then((res) => res.data?.messages ?? []);
  } catch (err) {
    console.error(err);
    // const id = await createChat().then((res) => res.data ?? "");
    // console.log(`Chat created with ID: ${id}.. Redirecting user..`);
    // if (id === null || id === "") {
    //   console.error("Chat creation failed");
    //   return <div>Chat creation failed</div>;
    // }
    // redirect(`/chat/${id}`);
    return <div>Chat not found</div>;
  }

  return (
    <Page>
      <Chat chatId={id} initialMessages={messages} />
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
