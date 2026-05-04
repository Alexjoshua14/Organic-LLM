import { render as rtlRender } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { installTestJsdom } from "./install-test-jsdom";

/**
 * Ensures JSDOM globals (idempotent). Safe to call from every test; install runs once.
 */
export function ensureDom() {
  installTestJsdom();
}

ensureDom();

type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  wrapper?: ({ children }: { children: ReactNode }) => ReactElement;
};

/**
 * Shared render helper for future provider/component tests.
 */
export function render(
  ui: ReactElement,
  options?: RenderWithProvidersOptions,
) {
  ensureDom();

  const { wrapper, ...rest } = options ?? {};
  return rtlRender(ui, {
    wrapper,
    ...rest,
  });
}
