import Page from "@/components/page";
import { Chat } from "@/components/chat/chat";
import { createChat, loadChat } from "@/util/chat-store";
import { redirect } from "next/navigation";
import { UIMessage } from "ai";
import { generateChatTitle } from "@/lib/llm/chat-helpers";
import { updateChatTitle } from "@/data/supabase/chat";
import { Thread } from "@/lib/schemas/chat";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: chatId } = await params;

  const id = chatId;

  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  try {
    const chatDataRes = await loadChat(id)

    if (chatDataRes.error || chatDataRes.data === null) {
      throw chatDataRes.error;
    }

    chatData = chatDataRes.data;

    if (chatData.thread.title === null && chatData.messages.length > 3) {
      const titleRes = await generateChatTitle(id);
      if (titleRes.error) {
        throw titleRes.error;
      }
      chatData.thread.title = titleRes.data;
      await updateChatTitle(id, titleRes.data ?? "");
    }
  } catch (err) {
    console.error(err);
    // const id = await createChat().then((res) => res.data ?? "");
    // console.log(`Chat created with ID: ${id}.. Redirecting user..`);
    // if (id === null || id === "") {
    //   console.error("Chat creation failed");
    //   return <div>Chat creation failed</div>;
    // }
    // redirect(`/chat/${id}`);
    return <div>Chat creation failed</div>;
  }

  return (
    <Page>
      <Chat chatData={chatData} />
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
