import { AIInput } from "../chat-experimental/ai-input";
import { glass } from "../design-system/primitives";
import Page from "../layout/page";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { SandboxGatewayButton } from "./sandbox-gateway-button";
import { ShowcaseGatewayButton } from "./showcase-gateway-button";

export default function Home() {
  return (
    <Page className="overflow-hidden" transparentBackground>
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="absolute inset-0 flex flex-col items-center justify-center h-full w-full gap-10">
        <div
          data-dim-background
          className="flex flex-col items-center justify-center rounded-xl w-full max-w-sm sm:max-w-xl gap-6"
        >
          <AIInput />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <SandboxGatewayButton />
            <ShowcaseGatewayButton />
          </div>
        </div>
      </div>
    </Page>
  );
}
