import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import { ClerkProvider } from "@clerk/nextjs";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontInter, fontSatoshi, fontCommissioner } from "@/config/fonts";
import { ControlCluster } from "@/components/layout/countrol-cluster";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/third-party/ui/sidebar";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ChatProvider } from "@/lib/context/chat-context";

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
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html suppressHydrationWarning lang="en" className="h-full overflow-hidden">
        <head />
        <body
          className={clsx(
            "h-dvh text-foreground bg-background font-sans antialiased max-w-dvw overflow-hidden",
            fontInter.variable,
            fontSatoshi.variable,
            fontCommissioner.variable,
          )}
        >
          <Providers
            themeProps={{ attribute: "class", defaultTheme: "system" }}
          >
            <ChatProvider>
              <SidebarProvider>
                <Sidebar />
                <ControlCluster />
                <main className="pt-4 grow w-full overflow-hidden bg-background sm:bg-background-secondary h-full">
                  <SidebarTrigger className="absolute top-4 left-4 z-20" />
                  {children}
                </main>
              </SidebarProvider>
            </ChatProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
