import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";

import { CodeCopyButton, CodeWrapButton } from "@/components/shared/code/code-actions";
import { CodeScroll, CodeSurface } from "@/components/shared/code/code-surface";
import { CodeMetaRow, CodePlain, CodeRow, CodeTable } from "@/components/shared/code/code-table";

const writeText = mock(async (_text: string) => {});
const originalClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  cleanup();
  if (originalClipboard)
    Object.defineProperty(globalThis.navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(globalThis.navigator, "clipboard");
});

describe("CodeSurface and CodeScroll", () => {
  test("the surface carries the palette, the font variable and the wrap state", () => {
    const view = render(
      <CodeSurface wrap data-extra="yes">
        <span>inside</span>
      </CodeSurface>
    );
    const surface = view.container.firstElementChild as HTMLElement;

    expect(surface.className).toContain("organic-code");
    expect(surface.className).toContain("not-prose");
    expect(surface.className).toContain("--font-mono-test");
    expect(surface.dataset.wrap).toBe("true");
    expect(surface.dataset.extra).toBe("yes");
  });

  test("a scroll region is a named, focusable region; wrapped ones drop the tab stop", () => {
    const view = render(
      <>
        <CodeScroll label="Diff of a.ts" digits={3}>
          <span />
        </CodeScroll>
        <CodeScroll focusable={false} label="Wrapped code">
          <span />
        </CodeScroll>
      </>
    );
    const [scrollable, wrapped] = view.getAllByRole("region");

    expect(scrollable!.getAttribute("aria-label")).toBe("Diff of a.ts");
    expect(scrollable!.getAttribute("tabindex")).toBe("0");
    expect(scrollable!.className).toContain("organic-focus");
    expect(scrollable!.getAttribute("style")).toContain("--code-digits: 3");
    expect(wrapped!.hasAttribute("tabindex")).toBe(false);
  });
});

describe("CodeRow", () => {
  function rows(props: Parameters<typeof CodeRow>[0]) {
    const view = render(
      <table>
        <tbody>
          <CodeRow {...props} />
        </tbody>
      </table>
    );

    return view.container.querySelector("tr")!;
  }

  test("a diff row has old and new gutters, a named sign and the code", () => {
    const row = rows({
      kind: "add",
      newNo: 8,
      oldNo: null,
      showNew: true,
      showOld: true,
      showSign: true,
      sign: "+",
      signLabel: "Added line",
      text: "  const a = 1;",
      children: "const a = 1;",
    });
    const cells = [...row.querySelectorAll("td")];

    expect(cells).toHaveLength(4);
    expect(cells.map((cell) => cell.textContent)).toEqual(["", "8", "+", "const a = 1;"]);
    expect(cells[2]!.getAttribute("aria-label")).toBe("Added line");
    expect(row.dataset.kind).toBe("add");
  });

  test("a code row has one optional gutter and no sign column", () => {
    expect(
      rows({ newNo: 3, showNew: true, text: "x", children: "x" }).querySelectorAll("td")
    ).toHaveLength(2);
    expect(rows({ text: "x", children: "x" }).querySelectorAll("td")).toHaveLength(1);
  });

  test("indent drives the guides, and an empty line still holds its height", () => {
    const row = rows({ text: "      deep", children: "" });

    expect(row.getAttribute("style")).toContain("--indent-columns: 6");
    expect(row.querySelector("code")?.textContent).toBe("​");
  });

  test("meta rows span the table and plain blocks are one text node", () => {
    const view = render(
      <>
        <table>
          <tbody>
            <CodeMetaRow columns={4}>No newline at end of file</CodeMetaRow>
          </tbody>
        </table>
        <CodePlain>{"one\ntwo"}</CodePlain>
      </>
    );

    expect(view.container.querySelector("td[colspan='3']")).not.toBeNull();
    expect(view.container.querySelector("pre")?.textContent).toBe("one\ntwo");
  });

  test("a table renders its caption for screen readers only", () => {
    const view = render(
      <CodeTable caption="Changed lines in a.ts">
        <CodeRow text="x">x</CodeRow>
      </CodeTable>
    );

    expect(view.container.querySelector("caption")?.textContent).toBe("Changed lines in a.ts");
  });
});

describe("CodeCopyButton and CodeWrapButton", () => {
  test("copies exactly the text it was given and confirms in words and to assistive tech", async () => {
    const view = render(
      <CodeCopyButton
        announce={{ copied: "Diff copied", failed: "Could not copy the diff" }}
        ariaLabel="Copy diff of a.ts"
        label="Copy diff"
        text={"line one\nline two"}
      />
    );

    fireEvent.click(view.getByRole("button", { name: "Copy diff of a.ts" }));
    await waitFor(() => expect(view.getByRole("button", { name: "Copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith("line one\nline two");
    expect(view.getByRole("status").textContent).toBe("Diff copied");
  });

  test("says so when the clipboard refuses", async () => {
    writeText.mockImplementationOnce(async () => {
      throw new Error("refused");
    });
    const view = render(<CodeCopyButton text="x" />);

    fireEvent.click(view.getByRole("button", { name: "Copy code" }));
    await waitFor(() => expect(view.getByText("Copy failed")).toBeTruthy());
    expect(view.getByRole("status").textContent).toBe("Could not copy the code");
  });

  test("the wrap toggle reports its state as an icon or a text button", () => {
    let pressed = false;
    const view = render(
      <>
        <CodeWrapButton pressed={pressed} onToggle={() => (pressed = !pressed)} />
        <CodeWrapButton pressed variant="text" onToggle={() => {}} />
      </>
    );
    const [icon, text] = view.getAllByRole("button");

    expect(icon!.getAttribute("aria-label")).toBe("Wrap lines");
    expect(icon!.getAttribute("aria-pressed")).toBe("false");
    expect(text!.textContent).toBe("Wrap lines");
    expect(text!.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(icon!);
    expect(pressed).toBe(true);
  });
});
