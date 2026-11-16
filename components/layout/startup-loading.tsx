import {
  OrganicActivityMark,
  type ActivityGlassByState,
} from "@/components/agents/organic-activity-mark";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";

// The large standalone mark needs less diffusion to keep its dots legible on light chrome.
const STARTUP_AGENT_GLASS: ActivityGlassByState = {
  working: { blur: 3, brightness: 1, opacity: 0.22 },
};

/** Visible in streamed HTML; no auth, app providers, mount gate, or minimum duration. */
export function StartupLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading Organic LLM"
      className="page-liquid-chrome relative isolate flex h-dvh w-full items-center justify-center overflow-hidden text-foreground"
      data-startup-loading
      role="status"
    >
      <LiquidChromeSsrFill />
      <AdaptiveLiquidChrome dimOnHover={false} interactive={false} />
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
        <OrganicActivityMark
          className="size-32 rounded-3xl sm:size-40"
          glassByState={STARTUP_AGENT_GLASS}
          renderer="v0"
          seed="organic-startup"
          state="working"
        />
        <p className="text-sm font-medium tracking-wide text-foreground/70">Loading Organic</p>
      </div>
    </div>
  );
}
