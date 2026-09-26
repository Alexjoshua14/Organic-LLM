"use client";

import { useEffect, useRef } from "react";

import { useSidebar } from "@/components/third-party/ui/sidebar";

/**
 * While the multiagent dashboard is open, collapse the app thread-list sidebar so it is not a
 * permanent wall. Restoring normal chat (toggle off / unmount) brings the prior open state back.
 */
export function MultitaskSidebarGate({ dashboardOpen }: { dashboardOpen: boolean }) {
  const { setOpen, isMobile, setOpenMobile } = useSidebar();
  const previousDesktopOpen = useRef<boolean | null>(null);

  useEffect(() => {
    if (isMobile) {
      if (dashboardOpen) setOpenMobile(false);

      return;
    }

    if (dashboardOpen) {
      setOpen((wasOpen) => {
        if (previousDesktopOpen.current === null) {
          previousDesktopOpen.current = wasOpen;
        }

        return false;
      });

      return;
    }

    if (previousDesktopOpen.current !== null) {
      setOpen(previousDesktopOpen.current);
      previousDesktopOpen.current = null;
    }
  }, [dashboardOpen, isMobile, setOpen, setOpenMobile]);

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
