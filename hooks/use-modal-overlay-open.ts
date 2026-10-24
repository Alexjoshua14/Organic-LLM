"use client";

import { useEffect, useState } from "react";

function isModalOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;

  return Boolean(
    document.querySelector('[data-slot="dialog-overlay"][data-state="open"]') ||
      document.querySelector('[data-slot="dialog-content"][data-state="open"]') ||
      document.querySelector('[data-slot="sheet-content"][data-state="open"]')
  );
}

/** True while a Radix dialog or sheet is open — coachmarks should yield. */
export function useModalOverlayOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setOpen(isModalOverlayOpen());

    update();

    const observer = new MutationObserver(update);

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state"],
    });

    return () => observer.disconnect();
  }, []);

  return open;
}
