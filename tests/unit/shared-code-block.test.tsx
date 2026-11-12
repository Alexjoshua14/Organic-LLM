import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";

import { CodeBlock } from "@/components/shared/code-block";
import { codeLanguageLabel, resolveHighlightLanguage } from "@/components/shared/code-highlight";

const copyText = mock(async (_text: string) => true);

mock.module("@/lib/clipboard/copy", () => ({ copyTextToClipboard: copyText }));

const SOURCE = ["const a = 7;", "function f(x: string) {", '  return "s";', "}"].join("\n");

function block(code: string, language?: string, props: Record<string, unknown> = {}) {
  return render(
    <CodeBlock {...props}>
      <code className={language ? `language-${language}` : undefined}>{`${code}\n`}</code>
    </CodeBlock>
  );
}

beforeEach(() => copyText.mockClear());
afterEach(() => cleanup());

describe("language resolution", () => {
  test("resolves aliases and fence labels to a registered grammar", () => {
    expect(resolveHighlightLanguage("ts")).toBe("typescript");
    expect(resolveHighlightLanguage("language-TS")).toBe("typescript");
    expect(resolveHighlightLanguage("sh")).toBe("bash");
    expect(resolveHighlightLanguage("html")).toBe("markup");
    expect(resolveHighlightLanguage("python")).toBe("python");
  });

  test("unknown or missing languages have no grammar and a readable label", () => {
    expect(resolveHighlightLanguage("brainfuck")).toBeUndefined();
    expect(resolveHighlightLanguage(undefined)).toBeUndefined();
    expect(codeLanguageLabel("ts")).toBe("TypeScript");
    expect(codeLanguageLabel(undefined)).toBe("Code");
    expect(codeLanguageLabel("text")).toBe("Code");
    expect(codeLanguageLabel("brainfuck")).toBe("Brainfuck");
    expect(codeLanguageLabel("zig")).toBe("ZIG");
  });
});

describe("CodeBlock", () => {
  test("shows the language, line count and highlighted tokens for a known language", () => {
    const view = block(SOURCE, "ts");

    expect(view.getByText("TypeScript")).toBeTruthy();
    expect(view.getByText("· 4 lines")).toBeTruthy();
    expect(view.container.querySelector(".token.keyword")?.textContent).toBe("const");
    expect(view.container.querySelectorAll("code").length).toBe(4);
  });

  test("an unknown language renders every line as plain text, unhighlighted", () => {
    const view = block(SOURCE, "brainfuck");

    expect(view.container.querySelector(".token")).toBeNull();
    expect(view.container.textContent).toContain('return "s";');
    expect(view.container.querySelectorAll("code").length).toBe(4);
  });

  test("line numbers appear only from five lines up", () => {
    expect(block(SOURCE, "ts").queryByText("1")).toBeNull();
    cleanup();
    const numbered = block(`${SOURCE}\n// five`, "ts");

    expect(numbered.getByText("1")).toBeTruthy();
    expect(numbered.getByText("5")).toBeTruthy();
  });

  test("copy sends the exact raw source, without the trailing newline", async () => {
    const view = block(SOURCE, "ts");

    fireEvent.click(view.getByRole("button", { name: "Copy code" }));
    await waitFor(() => expect(copyText).toHaveBeenCalledTimes(1));
    expect(copyText.mock.calls[0][0]).toBe(SOURCE);
    await waitFor(() => expect(view.getByText("Copied")).toBeTruthy());
  });

  test("a long block streaming in stays plain until it settles, then highlights", async () => {
    const long = (n: number) =>
      Array.from({ length: n }, (_, i) => `const v${i} = ${i};`).join("\n");
    const view = block(long(80), "ts");

    // Already complete on mount: highlighted straight away.
    expect(view.container.querySelector(".token.keyword")).not.toBeNull();

    view.rerender(
      <CodeBlock>
        <code className="language-ts">{`${long(81)}\n`}</code>
      </CodeBlock>
    );
    expect(view.container.querySelector(".token")).toBeNull();
    expect(view.container.textContent).toContain("const v80 = 80;");
    await waitFor(() => expect(view.container.querySelector(".token.keyword")).not.toBeNull());
  });

  test("a short block highlights on every change with no settle delay", () => {
    const view = block("const a = 1;", "ts");

    view.rerender(
      <CodeBlock>
        <code className="language-ts">{"const a = 1;\nconst b = 2;\n"}</code>
      </CodeBlock>
    );
    expect(view.container.querySelectorAll(".token.keyword").length).toBe(2);
  });

  test("a failed copy says so", async () => {
    copyText.mockImplementationOnce(async () => false);
    const view = block(SOURCE, "ts");

    fireEvent.click(view.getByRole("button", { name: "Copy code" }));
    await waitFor(() => expect(view.getByText("Copy failed")).toBeTruthy());
  });

  test("wrap starts from the prop and the header toggles it", () => {
    const view = block(SOURCE, "ts", { wrap: true });
    const root = view.container.firstElementChild as HTMLElement;
    const toggle = view.getByRole("button", { name: "Wrap lines" });

    expect(root.dataset.wrap).toBe("true");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(root.dataset.wrap).toBe("false");
  });

  test("mermaid fences keep their diagram with no code chrome", () => {
    // react-markdown hands CodeBlock its own `code` component, which renders the diagram.
    function Diagram({ children }: { className?: string; children?: string }) {
      return <span data-testid="diagram">{children}</span>;
    }
    const view = render(
      <CodeBlock>
        <Diagram className="language-mermaid">{"graph TD\n  A --> B"}</Diagram>
      </CodeBlock>
    );

    expect(view.getByTestId("diagram")).toBeTruthy();
    expect(view.queryByRole("button", { name: "Copy code" })).toBeNull();
    expect(view.queryByText("Code")).toBeNull();
  });

  test("children that are not plain text fall back to rendering as given", () => {
    const view = render(
      <CodeBlock>
        <code>
          <span data-testid="pre-tokenized">already highlighted</span>
        </code>
      </CodeBlock>
    );

    expect(view.getByTestId("pre-tokenized")).toBeTruthy();
    expect(view.getByRole("button", { name: "Copy code" }).hasAttribute("disabled")).toBe(true);
  });
});
