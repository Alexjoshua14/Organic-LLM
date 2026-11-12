import "@/styles/globals.css";
import { Suspense } from "react";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { AppThemeProvider } from "./theme-provider";
import { SessionShell } from "./session-shell";

import { siteConfig } from "@/config/site";
import { fontInter, fontSatoshi, fontCommissioner } from "@/config/fonts";
import { StartupLoading } from "@/components/layout/startup-loading";

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
    <html suppressHydrationWarning className="h-full overflow-hidden" lang="en">
      <body
        className={clsx(
          "h-dvh text-foreground font-sans antialiased max-w-dvw overflow-hidden",
          fontInter.variable,
          fontSatoshi.variable,
          fontCommissioner.variable
        )}
      >
        <AppThemeProvider>
          {/* Send the document and loader before session and admin reads complete. */}
          <Suspense fallback={<StartupLoading />}>
            <SessionShell>{children}</SessionShell>
          </Suspense>
        </AppThemeProvider>
      </body>
    </html>
  );
}
