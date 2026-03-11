import { render as rtlRender } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { JSDOM } from "jsdom";
import type { ReactElement, ReactNode } from "react";

function setGlobalProperty(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

/**
 * Creates a minimal DOM for component tests when Bun is running in a non-DOM
 * environment. Tests can import this helper instead of repeating setup.
 */
export function ensureDom() {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return;
  }

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  setGlobalProperty("window", dom.window);
  setGlobalProperty("document", dom.window.document);
  setGlobalProperty("navigator", dom.window.navigator);
  setGlobalProperty("HTMLElement", dom.window.HTMLElement);
  setGlobalProperty("Element", dom.window.Element);
  setGlobalProperty("SVGElement", dom.window.SVGElement);
  setGlobalProperty("Node", dom.window.Node);
  setGlobalProperty("Event", dom.window.Event);
  setGlobalProperty("MouseEvent", dom.window.MouseEvent);
  setGlobalProperty("KeyboardEvent", dom.window.KeyboardEvent);
  setGlobalProperty("MutationObserver", dom.window.MutationObserver);
  setGlobalProperty("getComputedStyle", dom.window.getComputedStyle.bind(dom.window));
  setGlobalProperty("requestAnimationFrame", (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(Date.now()), 0) as unknown as number;
  });
  setGlobalProperty("cancelAnimationFrame", (id: number) => clearTimeout(id));
  setGlobalProperty("IS_REACT_ACT_ENVIRONMENT", true);
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
