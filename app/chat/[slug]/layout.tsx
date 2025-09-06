import { ChatProvider } from "@/lib/context/chat-context";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
