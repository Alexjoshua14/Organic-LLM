import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/** Pure helper for tests — Enter submits when any input device is desktop-like. */
export function evaluateSubmitOnEnter(anyFinePointer: boolean, anyHover: boolean): boolean {
  return anyFinePointer || anyHover;
}

/**
 * Whether plain Enter should submit chat (vs newline + submit button).
 * Uses input capability, not viewport width — narrow desktop windows still submit on Enter.
 */
export function useSubmitOnEnter(): boolean {
  const [submitOnEnter, setSubmitOnEnter] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const fineMql = window.matchMedia("(any-pointer: fine)");
    const hoverMql = window.matchMedia("(any-hover: hover)");

    const onChange = () => {
      setSubmitOnEnter(evaluateSubmitOnEnter(fineMql.matches, hoverMql.matches));
    };

    fineMql.addEventListener("change", onChange);
    hoverMql.addEventListener("change", onChange);
    onChange();

    return () => {
      fineMql.removeEventListener("change", onChange);
      hoverMql.removeEventListener("change", onChange);
    };
  }, []);

  return submitOnEnter ?? true;
}
