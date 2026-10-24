"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { KnowledgeCacheProvider } from "@/hooks/use-knowledge-cache";
import { ThrottledThemeProvider } from "@/lib/theme/ThrottledThemeProvider";
import { Toaster } from "@/components/third-party/ui/sonner";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        <ThrottledThemeProvider>
          <KnowledgeCacheProvider>
            {children}
            <Toaster position="bottom-right" />
          </KnowledgeCacheProvider>
        </ThrottledThemeProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
