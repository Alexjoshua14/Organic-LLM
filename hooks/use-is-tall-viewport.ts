"use client";

import * as React from "react";

import {
  isTallViewport,
  tallSidebarMaxHeightCss,
  TALL_VIEWPORT_MIN_WIDTH_PX,
} from "@/lib/sidebar/tall-viewport";

export type TallViewportState = {
  isTall: boolean;
  maxHeightCss: string;
};

const INITIAL: TallViewportState = {
  isTall: false,
  maxHeightCss: "88svh",
};

/**
 * Desktop portrait / tall windows: floating sidebar with an aspect-capped height.
 * Mobile widths stay false so the sheet sidebar remains the phone path.
 */
export function useIsTallViewport(): TallViewportState {
  const [state, setState] = React.useState<TallViewportState>(INITIAL);

  React.useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTall = isTallViewport(width, height);

      setState({
        isTall,
        maxHeightCss: isTall ? tallSidebarMaxHeightCss(width, height) : INITIAL.maxHeightCss,
      });
    };

    const mql = window.matchMedia(`(min-width: ${TALL_VIEWPORT_MIN_WIDTH_PX}px)`);

    mql.addEventListener("change", update);
    window.addEventListener("resize", update);
    update();

    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return state;
}
