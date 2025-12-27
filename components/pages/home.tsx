import { AIInput } from "../chat-experimental/ai-input";
import { glass } from "../design-system/primitives";
import Page from "../layout/page";

import LiquidChrome from "@/components/background/LiquidChrome";

export default function Home() {
  return (
    <Page transparentBackground>
      <LiquidChrome />
      <div className={`fixed inset-0 flex flex-col items-center justify-center h-full w-full gap-10`}>
        <div className={`bg-secondary/75 flex flex-col items-center justify-center rounded-xl w-full max-w-xl`}>
          <AIInput />
        </div>
      </div>
    </Page>
  );
}
