import Page from "../layout/page";

import { AdminBlogLink } from "./admin-blog-link";
import { SandboxGatewayButton } from "./sandbox-gateway-button";
import { ShowcaseGatewayButton } from "./showcase-gateway-button";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { LauncherHomeHint } from "@/components/aion-launcher/launcher-home-hint";

export default function Home() {
  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="absolute inset-0 flex flex-col items-center justify-center h-full w-full gap-10">
        <div
          data-dim-background
          className="flex flex-col items-center justify-center rounded-xl w-full max-w-sm sm:max-w-xl gap-6"
        >
          <LauncherHomeHint />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <SandboxGatewayButton />
            <ShowcaseGatewayButton />
            <AdminBlogLink />
          </div>
        </div>
      </div>
    </Page>
  );
}
