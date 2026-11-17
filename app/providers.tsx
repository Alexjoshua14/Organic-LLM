"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";

import { KnowledgeCacheProvider } from "@/hooks/use-knowledge-cache";
import { ThrottledThemeProvider } from "@/lib/theme/ThrottledThemeProvider";
import { Toaster } from "@/components/third-party/ui/sonner";

export interface ProvidersProps {
  children: React.ReactNode;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
  }
}

export function Providers({ children }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <ThrottledThemeProvider>
        <KnowledgeCacheProvider>
          {children}
          <Toaster position="bottom-right" />
        </KnowledgeCacheProvider>
      </ThrottledThemeProvider>
    </HeroUIProvider>
  );
}
