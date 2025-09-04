import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import { ClerkProvider } from "@clerk/nextjs";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { ControlCluster } from "@/components/layout/countrol-cluster";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/third-party/ui/sidebar";
import { Sidebar } from "@/components/sidebar/sidebar";

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
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
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
      <html suppressHydrationWarning lang="en">
        <head />
        <body
          className={clsx(
            "min-h-dvh text-foreground bg-background font-sans antialiased",
            fontSans.variable,
          )}
        >
          <Providers
            themeProps={{ attribute: "class", defaultTheme: "system" }}
          >
            <SidebarProvider>
              <Sidebar />
              <ControlCluster />
              <main className="pt-4 grow bg-background sm:bg-background-secondary">
                <SidebarTrigger className="absolute top-3 left-3 z-20" />
                {children}
              </main>
            </SidebarProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
