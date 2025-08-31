import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import { ClerkProvider } from "@clerk/nextjs";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { ControlCluster } from "@/components/countrol-cluster";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Sidebar as NewSidebar } from "@/components/sidebar/sidebar";

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
            "min-h-screen text-foreground bg-background font-sans antialiased",
            fontSans.variable,
          )}
        >
          <Providers
            themeProps={{ attribute: "class", defaultTheme: "system" }}
          >
            <SidebarProvider>
              <NewSidebar />
              {/*<div className="relative flex">*/}
              {/*<Sidebar />*/}
              <ControlCluster />
              <main className="pt-4 grow bg-background-secondary">
                <SidebarTrigger className="absolute top-3 left-3 z-20" />
                {children}
              </main>
              {/*</div>*/}
            </SidebarProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
