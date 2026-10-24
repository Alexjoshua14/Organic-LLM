import type { Metadata } from "next";

import { MorphChatRabbitDemo } from "../_components/morph-chat-rabbit-demo/MorphChatRabbitDemo";

import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Morph chat ↔ rabbit"),
};

export default function MorphChatArchetypePage() {
  return (
    <>
      <LiquidChromeSsrFill />
      <MorphChatRabbitDemo />
    </>
  );
}
