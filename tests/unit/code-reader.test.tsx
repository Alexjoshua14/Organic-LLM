import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";

import { CodeDiff } from "@/components/chat/gen-ui/blocks/CodeDiff";
import { CodeBlock } from "@/components/shared/code-block";
import { FIXTURE_CODE_DIFF } from "@/lib/schemas/gen-ui/fixtures";

// Other suites can leave a dialog in the document (portals sit outside what cleanup removes), so
// every query names this reader, and "closed" means that element left the document.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const LONG = Array.from({ length: 30 }, (_, i) => `const value${i} = ${i};`).join("\n");

function block(source: string) {
  return (
    <CodeBlock>
      <code className="language-ts">{source}</code>
    </CodeBlock>
  );
}

function surfaceOf(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[data-glance]") as HTMLElement;
}

describe("the code glance (phone presentation, decided from the content)", () => {
  test("a short snippet is not capped and has nothing to open", () => {
    const view = render(block("const a = 1;\nconst b = 2;"));

    expect(surfaceOf(view.container).dataset.capped).toBeUndefined();
    expect(view.queryByRole("button", { name: /in the reader/ })).toBeNull();
    expect(view.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  test("a block past the glance length is capped and offers Show all with the real count", () => {
    const view = render(block(LONG));

    expect(surfaceOf(view.container).dataset.capped).toBe("true");
    expect(view.getByRole("button", { name: /Show all 30 lines/ })).toBeTruthy();
    expect(view.getByRole("button", { name: "Open TypeScript code in the reader" })).toBeTruthy();
  });

  test("a block of five to fourteen lines opens in the reader but is not capped", () => {
    const view = render(block("a\nb\nc\nd\ne\nf"));

    expect(surfaceOf(view.container).dataset.capped).toBeUndefined();
    expect(view.getByRole("button", { name: "Open TypeScript code in the reader" })).toBeTruthy();
  });
});

describe("the code reader", () => {
  test("opens as a labelled modal dialog with every line numbered", () => {
    const view = render(block(LONG));

    fireEvent.click(view.getByRole("button", { name: "Open TypeScript code in the reader" }));

    const dialog = view.getByRole("dialog", { name: /TypeScript/ });

    expect(dialog.getAttribute("aria-modal") ?? "true").toBe("true");
    expect(dialog.querySelectorAll("tr")).toHaveLength(30);
    expect(dialog.textContent).toContain("30 lines");
  });

  test("Close closes it, and focus returns to the control that opened it", async () => {
    const view = render(block(LONG));
    const opener = view.getByRole("button", { name: "Open TypeScript code in the reader" });

    opener.focus();
    fireEvent.click(opener);

    const dialog = view.getByRole("dialog", { name: /TypeScript/ });

    fireEvent.click(view.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    expect(document.activeElement).toBe(opener);
  });

  test("Escape closes it, and focus returns to the control that opened it", async () => {
    const view = render(block(LONG));
    const opener = view.getByRole("button", { name: "Open TypeScript code in the reader" });

    opener.focus();
    fireEvent.click(opener);

    const dialog = view.getByRole("dialog", { name: /TypeScript/ });

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(dialog.isConnected).toBe(false));
    expect(document.activeElement).toBe(opener);
  });

  test("wrap toggles inside the reader, and the text size steps and is remembered", () => {
    const view = render(block(LONG));

    fireEvent.click(view.getByRole("button", { name: "Open TypeScript code in the reader" }));

    const dialog = view.getByRole("dialog", { name: /TypeScript/ });
    const well = () => dialog.querySelector<HTMLElement>("[data-reader]") as HTMLElement;
    const wrap = view.getByRole("button", { name: "Wrap lines" });

    expect(well().dataset.wrap).toBe("false");
    fireEvent.click(wrap);
    expect(well().dataset.wrap).toBe("true");

    const sheet = dialog as HTMLElement;

    expect(sheet.style.getPropertyValue("--reader-size")).toBe("13px");
    fireEvent.click(view.getByRole("button", { name: "Larger text" }));
    expect(sheet.style.getPropertyValue("--reader-size")).toBe("14px");
    expect(window.localStorage.getItem("organic.code-reader.size")).toBe("3");
  });

  test("the text-size buttons stop at the ends", () => {
    window.localStorage.setItem("organic.code-reader.size", "0");

    const view = render(block(LONG));

    fireEvent.click(view.getByRole("button", { name: "Open TypeScript code in the reader" }));
    expect((view.getByRole("button", { name: "Smaller text" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  test("a streaming block keeps growing inside an open reader", () => {
    const view = render(block(LONG));

    fireEvent.click(view.getByRole("button", { name: "Open TypeScript code in the reader" }));
    view.rerender(block(`${LONG}\nconst extra = 1;`));

    expect(view.getByRole("dialog", { name: /TypeScript/ }).querySelectorAll("tr")).toHaveLength(
      31
    );
    expect(view.getByRole("dialog", { name: /TypeScript/ }).textContent).toContain("31 lines");
  });
});

describe("the diff reader", () => {
  test("a long file is capped in place and opens whole in the reader with a diff copy", () => {
    const view = render(<CodeDiff block={FIXTURE_CODE_DIFF} />);
    const toggle = view.container.querySelector<HTMLButtonElement>("h4 > button");

    if (toggle?.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle as HTMLElement);

    fireEvent.click(view.getAllByRole("button", { name: /Open the full diff/ })[0]);

    const dialog = view.getByRole("dialog", { name: /lib\/exa\/client\.ts/ });

    expect(dialog.textContent).toContain("lib/exa/client.ts");
    expect(dialog.querySelectorAll("tr[data-kind=add]").length).toBeGreaterThan(0);
    expect(dialog.querySelector("button[data-labelled]")?.textContent).toContain("Copy diff");
  });
});
