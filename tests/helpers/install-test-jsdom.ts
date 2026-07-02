import { JSDOM } from "jsdom";

/** JSDOM `window` (`DOMWindow` is not exported from the `jsdom` module). */
type JSDOMWindow = InstanceType<typeof JSDOM>["window"];

declare global {
  // eslint-disable-next-line no-var
  var __organicTestJsdomInstalled: boolean | undefined;
}

function setGlobalProperty(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

/**
 * `@react-aria/interactions` assigns `HTMLElement.prototype.focus` in strict mode.
 * Some runtimes expose non-writable `focus`; normalize so the assignment succeeds.
 */
function patchFocusForReactAria(win: JSDOMWindow): void {
  const ctors = [win.HTMLElement, win.Element, win.SVGElement].filter(
    (C): C is typeof win.HTMLElement => Boolean(C?.prototype),
  );
  for (const C of ctors) {
    const proto = C.prototype as HTMLElement;
    const desc = Object.getOwnPropertyDescriptor(proto, "focus");
    if (!desc) continue;
    if (desc.writable === true && desc.configurable !== false) continue;

    const original = typeof desc.value === "function" ? desc.value : undefined;
    if (typeof original !== "function") continue;

    try {
      Object.defineProperty(proto, "focus", {
        configurable: true,
        enumerable: Boolean(desc.enumerable),
        writable: true,
        value: original,
      });
    } catch {
      /* non-configurable focus */
    }
  }
}

/**
 * Install JSDOM globals once per test process. Always overwrites existing
 * `window`/`document` (e.g. Bun CI stubs) so libraries like `@react-aria/interactions`
 * patch JSDOM's `HTMLElement.prototype.focus`, not a readonly builtin.
 */
export function installTestJsdom(): void {
  if (globalThis.__organicTestJsdomInstalled) {
    return;
  }
  globalThis.__organicTestJsdomInstalled = true;

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  patchFocusForReactAria(dom.window);

  setGlobalProperty("window", dom.window);
  setGlobalProperty("document", dom.window.document);
  setGlobalProperty("localStorage", dom.window.localStorage);
  setGlobalProperty("sessionStorage", dom.window.sessionStorage);
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
