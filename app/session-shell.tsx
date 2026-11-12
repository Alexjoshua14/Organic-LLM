import { cookies } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Analytics } from "@vercel/analytics/next";

import { Providers } from "./providers";

import { ControlCluster } from "@/components/layout/countrol-cluster";
import { AppOnlyChrome } from "@/components/layout/app-only-chrome";
import { ThemeColorSync } from "@/components/layout/theme-color-sync";
import { SidebarProvider, SidebarTrigger } from "@/components/third-party/ui/sidebar";
import { getSidebarDefaultOpenFromCookieValue, SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { Sidebar } from "@/components/sidebar/sidebar";
import { AionLauncherProvider } from "@/components/aion-launcher/aion-launcher";
import { ChatProvider } from "@/lib/context/chat-context";
import { TTSProvider } from "@/lib/context/tts-context";
import { FontProvider } from "@/components/FontProvider";
import { OnboardingHost } from "@/components/onboarding/onboarding-host";
import { PerfHudGate } from "@/components/perf/perf-hud-gate";
import { VoiceLiveBarPageAnchor } from "@/components/voice/voice-live-bar-page-anchor";
import { PersonaSessionProvider } from "@/components/personas/persona-session-provider";
import { VoiceSessionProvider } from "@/components/voice/voice-session-provider";
import { glass } from "@/components/design-system/primitives";
import { GatewayVisibilityProvider } from "@/hooks/use-gateway-visibility";
import { resolveInitialGatewayVisibility } from "@/lib/admin/initial-gateway-visibility";

/** Session-aware app tree stays in the root layout, preserving voice across navigation. */
export async function SessionShell({ children }: { children: React.ReactNode }) {
  const [cookieStore, { userId }] = await Promise.all([cookies(), auth()]);
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
  const sidebarDefaultOpen = getSidebarDefaultOpenFromCookieValue(sidebarCookie);
  // Admin-only UI (the sidebar's Strata and Stage tiles) renders on the first paint from this
  // read. Access itself is still enforced by each admin page, model, and API on the server.
  const initialGatewayVisibility = await resolveInitialGatewayVisibility(userId);

  // Seed Clerk from the verified request; admin UI still receives the fresh server read.
  return (
    <ClerkProvider dynamic>
      <GatewayVisibilityProvider initial={initialGatewayVisibility}>
        <Providers>
          <ThemeColorSync />
          <FontProvider>
            <ChatProvider>
              <AionLauncherProvider>
                <TTSProvider>
                  {/* Root ownership keeps the Realtime call alive across client navigation. */}
                  <PersonaSessionProvider>
                    <VoiceSessionProvider>
                      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
                        <OnboardingHost>
                          <AppOnlyChrome>
                            <Sidebar />
                            <ControlCluster />
                          </AppOnlyChrome>
                          <main className="app-shell grow w-full overflow-hidden bg-transparent sm:bg-transparent-secondary h-full min-h-dvh">
                            <AppOnlyChrome>
                              <div
                                className={`${glass()} absolute top-[env(safe-area-inset-top,0px)] left-0 z-30 flex h-14 w-20 items-center rounded-br-lg pl-4 md:top-0 md:hidden`}
                                data-mobile-nav-chrome="sidebar-trigger"
                              >
                                <SidebarTrigger />
                              </div>
                              <div className={`hidden md:flex absolute top-4 left-0 pl-4 z-30`}>
                                <SidebarTrigger />
                              </div>
                            </AppOnlyChrome>
                            <VoiceLiveBarPageAnchor />
                            {children}
                            <PerfHudGate />
                            <Analytics />
                          </main>
                        </OnboardingHost>
                      </SidebarProvider>
                    </VoiceSessionProvider>
                  </PersonaSessionProvider>
                </TTSProvider>
              </AionLauncherProvider>
            </ChatProvider>
          </FontProvider>
        </Providers>
      </GatewayVisibilityProvider>
    </ClerkProvider>
  );
}
