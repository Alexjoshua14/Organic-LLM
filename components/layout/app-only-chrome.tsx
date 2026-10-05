"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

/** The public showcase has its own navigation; keep workspace controls in the app. */
export function AppOnlyChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/showcase" || pathname?.startsWith("/showcase/")) return null;

  return <>{children}</>;
}
