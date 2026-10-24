import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { StrictMode } from "react";

import { MultitaskSidebarGate } from "@/app/sandbox/arcadia/_components/multitask-sidebar-gate";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/third-party/ui/sidebar";
import { SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { render } from "../helpers/render";

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
const originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
const viewportListeners = new Set<() => void>();

function resizeViewport(width: number) {
  act(() => {
    window.innerWidth = width;
    viewportListeners.forEach((listener) => listener());
  });
}

beforeEach(() => {
  document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;
  window.innerWidth = 1280;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: window.innerWidth < 768,
      addEventListener: (_event: string, listener: () => void) => viewportListeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => viewportListeners.delete(listener),
    }),
  });
});

afterEach(() => {
  cleanup();
  viewportListeners.clear();
  document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;

  if (originalMatchMedia) {
    Object.defineProperty(window, "matchMedia", originalMatchMedia);
  } else {
    delete (window as Partial<Window>).matchMedia;
  }
  if (originalInnerWidth) Object.defineProperty(window, "innerWidth", originalInnerWidth);
});

function SidebarState() {
  const { open, openMobile, isMobile } = useSidebar();

  return (
    <>
      <output data-testid="desktop-state">{open ? "open" : "closed"}</output>
      <output data-testid="mobile-state">{openMobile ? "open" : "closed"}</output>
      <output data-testid="viewport">{isMobile ? "mobile" : "desktop"}</output>
    </>
  );
}

function App({ dashboardOpen = false, defaultOpen = true, mounted = true }) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {mounted ? <MultitaskSidebarGate dashboardOpen={dashboardOpen} /> : null}
      <SidebarTrigger />
      <SidebarState />
    </SidebarProvider>
  );
}

describe("Arcadia multiagent main sidebar", () => {
  test.each([true, false])("restores the prior desktop state (%s) when the dashboard closes", (defaultOpen) => {
    const app = render(<App defaultOpen={defaultOpen} />);

    app.rerender(<App defaultOpen={defaultOpen} dashboardOpen />);
    expect(app.getByTestId("desktop-state").textContent).toBe("closed");
    app.rerender(<App defaultOpen={defaultOpen} />);
    expect(app.getByTestId("desktop-state").textContent).toBe(defaultOpen ? "open" : "closed");
  });

  test("the trigger and keyboard shortcut can reopen the sidebar while the dashboard stays open", () => {
    const app = render(<App dashboardOpen />);

    fireEvent.click(app.getByRole("button", { name: "Toggle Sidebar" }));
    expect(app.getByTestId("desktop-state").textContent).toBe("open");
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(app.getByTestId("desktop-state").textContent).toBe("closed");
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(app.getByTestId("desktop-state").textContent).toBe("open");
    app.rerender(<App dashboardOpen />);
    expect(app.getByTestId("desktop-state").textContent).toBe("open");
  });

  test("leaving Arcadia restores the sidebar after its provider setter has changed", () => {
    const app = render(<App dashboardOpen />);

    expect(app.getByTestId("desktop-state").textContent).toBe("closed");
    app.rerender(<App mounted={false} />);
    expect(app.getByTestId("desktop-state").textContent).toBe("open");
  });

  test("Strict Mode preserves collapse, manual reopening, and restoration", () => {
    const app = render(<App defaultOpen={false} dashboardOpen />, { wrapper: StrictMode });

    expect(app.getByTestId("desktop-state").textContent).toBe("closed");
    fireEvent.click(app.getByRole("button", { name: "Toggle Sidebar" }));
    expect(app.getByTestId("desktop-state").textContent).toBe("open");
    app.rerender(<App defaultOpen={false} />);
    expect(app.getByTestId("desktop-state").textContent).toBe("closed");
  });

  test("mobile closes on entry and can reopen without changing the desktop state", () => {
    resizeViewport(390);
    const app = render(<App />);

    expect(app.getByTestId("viewport").textContent).toBe("mobile");
    fireEvent.click(app.getByRole("button", { name: "Toggle Sidebar" }));
    expect(app.getByTestId("mobile-state").textContent).toBe("open");
    app.rerender(<App dashboardOpen />);
    expect(app.getByTestId("mobile-state").textContent).toBe("closed");
    fireEvent.click(app.getByRole("button", { name: "Toggle Sidebar" }));
    expect(app.getByTestId("mobile-state").textContent).toBe("open");
    expect(app.getByTestId("desktop-state").textContent).toBe("open");
  });

  test("crossing the mobile breakpoint restores desktop state and collapses once per layout", () => {
    const app = render(<App dashboardOpen />);

    expect(app.getByTestId("desktop-state").textContent).toBe("closed");
    resizeViewport(390);
    expect(app.getByTestId("viewport").textContent).toBe("mobile");
    expect(app.getByTestId("desktop-state").textContent).toBe("open");
    fireEvent.click(app.getByRole("button", { name: "Toggle Sidebar" }));
    expect(app.getByTestId("mobile-state").textContent).toBe("open");
    resizeViewport(1280);
    expect(app.getByTestId("desktop-state").textContent).toBe("closed");
    app.rerender(<App />);
    expect(app.getByTestId("desktop-state").textContent).toBe("open");
  });
});
