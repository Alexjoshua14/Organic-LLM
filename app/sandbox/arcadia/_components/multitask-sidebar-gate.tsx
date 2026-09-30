"use client";

import { useEffect, useRef } from "react";

import { useSidebar } from "@/components/third-party/ui/sidebar";

/**
 * While the multiagent dashboard is open, collapse the app thread-list sidebar so it is not a
 * permanent wall. Restoring normal chat (toggle off / unmount) brings the prior open state back.
 */
export function MultitaskSidebarGate({ dashboardOpen }: { dashboardOpen: boolean }) {
  const { setOpen, open, isMobile, setOpenMobile } = useSidebar();
  const previousDesktopOpen = useRef<boolean | null>(null);
  const wasDashboardOpen = useRef(false);

  useEffect(() => {
    if (isMobile) {
      if (dashboardOpen) setOpenMobile(false);
      wasDashboardOpen.current = dashboardOpen;

      return;
    }

    if (dashboardOpen) {
      if (!wasDashboardOpen.current && previousDesktopOpen.current === null) {
        previousDesktopOpen.current = open;
      }
      wasDashboardOpen.current = true;
      if (open) setOpen(false);

      return;
    }

    wasDashboardOpen.current = false;

    if (previousDesktopOpen.current !== null) {
      setOpen(previousDesktopOpen.current);
      previousDesktopOpen.current = null;
    }
  }, [dashboardOpen, isMobile, open, setOpen, setOpenMobile]);

  useEffect(() => {
    return () => {
      if (previousDesktopOpen.current !== null) {
        setOpen(previousDesktopOpen.current);
        previousDesktopOpen.current = null;
      }
    };
  }, [setOpen]);

  return null;
}
