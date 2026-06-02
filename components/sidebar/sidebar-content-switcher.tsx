"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

type SidebarContentSwitcherProps = {
  normalContent: ReactNode;
  prototypeContent: ReactNode;
};

export function SidebarContentSwitcher({
  normalContent,
  prototypeContent,
}: SidebarContentSwitcherProps) {
  const pathname = usePathname() ?? "";
  const isPrototypeRoute =
    pathname === "/sandbox/prototypes" || pathname.startsWith("/sandbox/prototypes/");

  return isPrototypeRoute ? prototypeContent : normalContent;
}
