"use client";

import { useEffect, useRef } from "react";

import { useSidebar } from "@/components/third-party/ui/sidebar";

/**
 * Collapse the app thread-list sidebar on dashboard entry, while allowing manual reopening.
 * Restoring normal chat (toggle off / unmount) brings the prior desktop open state back.
 */
export function MultitaskSidebarGate({ dashboardOpen }: { dashboardOpen: boolean }) {
  const { setOpen, open, isMobile, setOpenMobile } = useSidebar();
  const sidebarRef = useRef({ open, setOpen, setOpenMobile });

  useEffect(() => {
    sidebarRef.current = { open, setOpen, setOpenMobile };
  }, [open, setOpen, setOpenMobile]);

  // SidebarProvider changes setOpen when open changes. Only dashboard / viewport transitions
  // should collapse or restore the sidebar; keep the current setter available for cleanup.
  useEffect(() => {
    if (!dashboardOpen) return;
    if (isMobile) {
      sidebarRef.current.setOpenMobile(false);

      return;
    }

    const previousDesktopOpen = sidebarRef.current.open;

    sidebarRef.current.setOpen(false);

    return () => sidebarRef.current.setOpen(previousDesktopOpen);
  }, [dashboardOpen, isMobile]);

  return null;
}
