import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontInter, fontSatoshi, fontCommissioner } from "@/config/fonts";
import { ControlCluster } from "@/components/layout/countrol-cluster";
import { SidebarProvider, SidebarTrigger } from "@/components/third-party/ui/sidebar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ChatProvider } from "@/lib/context/chat-context";
import { TTSProvider } from "@/lib/context/tts-context";
import { FontProvider } from "@/components/FontProvider";
import { glass } from "@/components/design-system/primitives";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/organic-llm.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141516" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html suppressHydrationWarning className="h-full overflow-hidden" lang="en">
        <body
          className={clsx(
            "h-dvh text-foreground bg-background font-sans antialiased max-w-dvw overflow-hidden",
            fontInter.variable,
            fontSatoshi.variable,
            fontCommissioner.variable
          )}
        >
          <Providers
            themeProps={{
              attribute: "class",
              defaultTheme: "system",
              enableSystem: true,
            }}
          >
            <FontProvider>
              <ChatProvider>
                <TTSProvider>
                  <SidebarProvider>
                    <Sidebar />
                    <ControlCluster />
                    <main className="grow w-full overflow-hidden bg-background sm:bg-background-secondary h-full min-h-dvh">
                      <div
                        className={`${glass()} absolute top-0 left-0 z-30 flex h-14 w-20 items-center rounded-br-lg pl-4 md:hidden`}
                        data-mobile-nav-chrome="sidebar-trigger"
                      >
                        <SidebarTrigger />
                      </div>
                      <div className={`hidden md:flex absolute top-4 left-0 pl-4 z-30`}>
                        <SidebarTrigger />
                      </div>
                      {children}
                      <Analytics />
                    </main>
                  </SidebarProvider>
                </TTSProvider>
              </ChatProvider>
            </FontProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
