import Page from "@/components/layout/page";
import { NewChat } from "@/components/chat/new-chat";
import { Chat } from "@/components/chat/chat";
import { UIMessage } from "@ai-sdk/react";
import { Thread } from "@/lib/schemas/chat";
import { NewChatNew } from "@/components/chat/new-chat-new";

export default function Home() {
  const chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  return (
    <Page>
      <div className="relative inline-block max-w-4xl h-full w-full text-center justify-center">
        <NewChatNew />
        {/* <NewChat /> */}
        {/*<span className={title()}>Make&nbsp;</span>
        <span className={title({ color: "violet" })}>beautiful&nbsp;</span>
        <br />
        <span className={title()}>
          websites regardless of your design experience.
        </span>
        <div className={subtitle({ class: "mt-4" })}>
          Beautiful, fast and modern React UI library.
        </div>*/}
      </div>
    </Page>
  );
}
