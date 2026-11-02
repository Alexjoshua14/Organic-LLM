/** Minimal matchMedia for component tests; restores the original browser surface on cleanup. */
export function installBrowserMedia() {
  const fragmentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "DocumentFragment");
  Object.defineProperty(globalThis, "DocumentFragment", {
    configurable: true,
    writable: true,
    value: window.DocumentFragment,
  });
  const original = window.matchMedia;
  const originalAbortController = globalThis.AbortController;
  globalThis.AbortController = window.AbortController;
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  });
  return () => {
    if (fragmentDescriptor)
      Object.defineProperty(globalThis, "DocumentFragment", fragmentDescriptor);
    else Reflect.deleteProperty(globalThis, "DocumentFragment");
    window.matchMedia = original;
    globalThis.AbortController = originalAbortController;
  };
}
