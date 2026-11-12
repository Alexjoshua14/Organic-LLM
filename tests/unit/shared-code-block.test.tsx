import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";

import { CodeBlock } from "@/components/shared/code-block";
import {
  HIGHLIGHT_LANGUAGES,
  HIGHLIGHT_LIMITS,
  HighlightBoundary,
  HighlightedText,
  codeLanguageLabel,
  languageForPath,
  preloadLanguage,
  resolveHighlightLanguage,
  splitSegments,
} from "@/components/shared/code-highlight";

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
    expect(codeLanguageLabel("xyz")).toBe("XYZ");
    expect(codeLanguageLabel("zig")).toBe("Zig");
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

describe("line-level highlighting (code diff rows)", () => {
  test("maps file paths to a language by extension", () => {
    expect(languageForPath("lib/memory/search.ts")).toBe("typescript");
    expect(languageForPath("app/page.TSX")).toBe("tsx");
    expect(languageForPath("scripts/deploy.sh")).toBe("bash");
    expect(languageForPath("Makefile")).toBe("makefile");
    expect(languageForPath("docker/Dockerfile")).toBe("docker");
    expect(languageForPath("LICENSE")).toBeUndefined();
    expect(languageForPath(undefined)).toBeUndefined();
  });

  test("splits runs at the emphasis boundaries without losing or reordering text", () => {
    const segments = [
      { text: "const", className: "token keyword" },
      { text: " total = ", className: "" },
      { text: "42", className: "token number" },
    ];
    const [before, inside, after] = splitSegments(segments, [4, 12]);
    const join = (parts: { text: string }[]) => parts.map((part) => part.text).join("");

    expect(join(before)).toBe("cons");
    expect(join(inside)).toBe("t total ");
    expect(join(after)).toBe("= 42");
    expect(`${join(before)}${join(inside)}${join(after)}`).toBe("const total = 42");
    expect(inside[0]).toEqual({ text: "t", className: "token keyword" });
    expect(splitSegments(segments, null)).toEqual([segments, [], []]);
  });

  test("renders tokens and wraps only the changed span in the emphasis element", () => {
    const view = render(
      <HighlightedText
        emphasis={[6, 11]}
        emphasisClassName="emph"
        language="typescript"
        text="const total = 42;"
      />
    );
    const emphasised = view.container.querySelector("[data-emphasis]");

    expect(view.container.textContent).toBe("const total = 42;");
    expect(view.container.querySelector(".token.keyword")?.textContent).toBe("const");
    expect(emphasised?.textContent).toBe("total");
    expect(emphasised?.className).toBe("emph");
  });

  test("an unknown language still renders and emphasises plain text", () => {
    const view = render(<HighlightedText emphasis={[0, 3]} language="cobol" text="abc def" />);

    expect(view.container.querySelector(".token")).toBeNull();
    expect(view.container.querySelector("[data-emphasis]")?.textContent).toBe("abc");
    expect(view.container.textContent).toBe("abc def");
  });
});

describe("lazy grammars", () => {
  test("a long-tail language is plain at first, then colors in place once its grammar loads", async () => {
    const view = block('puts "hello" # greet', "ruby");

    expect(view.container.textContent).toContain('puts "hello" # greet');
    expect(view.getByText("Ruby")).toBeTruthy();
    await waitFor(() => expect(view.container.querySelector(".token.string")).not.toBeNull());
    expect(view.container.textContent).toContain('puts "hello" # greet');
  });

  test("a loaded grammar highlights immediately on the next block", async () => {
    const first = block("x = 1", "ruby");

    await waitFor(() => expect(first.container.querySelector(".token.number")).not.toBeNull());
    cleanup();
    expect(block("y = 2", "ruby").container.querySelector(".token.number")).not.toBeNull();
  });

  test("every supported language loads, and highlighting keeps the source text exactly", async () => {
    const sample = 'name = "value" # note\nif x == 1 { run(x) }';
    const loaded = await Promise.all(
      HIGHLIGHT_LANGUAGES.map((language) => preloadLanguage(language))
    );

    expect(loaded.every(Boolean)).toBe(true);
    expect(await preloadLanguage("cobol")).toBe(false);

    for (const language of HIGHLIGHT_LANGUAGES) {
      const view = render(<HighlightedText language={language} text={sample} />);

      expect({ language, text: view.container.textContent }).toEqual({ language, text: sample });
      view.unmount();
    }
  });
});

describe("hostile and oversized input", () => {
  const INHERITED = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];

  test("inherited object keys are never treated as a language, label or extension", () => {
    for (const key of INHERITED) {
      expect(resolveHighlightLanguage(key)).toBeUndefined();
      expect(typeof codeLanguageLabel(key)).toBe("string");
      expect(languageForPath(`src/file.${key}`)).toBeUndefined();
      expect(languageForPath(key)).toBeUndefined();
      expect(() => block("x = 1", key)).not.toThrow();
      cleanup();
      expect(() => render(<HighlightedText language={key} text="x" />)).not.toThrow();
      cleanup();
    }
  });

  test("non-string language and path values are ignored, not thrown on", () => {
    for (const value of [42, {}, [], null, undefined, () => 1]) {
      expect(resolveHighlightLanguage(value)).toBeUndefined();
      expect(languageForPath(value)).toBeUndefined();
      expect(codeLanguageLabel(value)).toBe("Code");
    }
  });

  test("an unknown fence label is cut and stripped to safe characters", () => {
    const label = codeLanguageLabel(`evil<script>alert(1)</script>${"x".repeat(500)}\u202e`);

    expect(label.length).toBeLessThanOrEqual(HIGHLIGHT_LIMITS.labelChars);
    expect(label).toMatch(/^[\w+#.-]+$/);
    expect(codeLanguageLabel("a".repeat(200)).length).toBeLessThanOrEqual(
      HIGHLIGHT_LIMITS.labelChars
    );
  });

  test("a block over the line limit renders as one plain text node, still copyable", async () => {
    const lines = Array.from(
      { length: HIGHLIGHT_LIMITS.blockLines + 1 },
      (_, i) => `const v${i} = ${i};`
    );
    const source = lines.join("\n");
    const view = block(source, "ts");

    expect(view.container.querySelector(".token")).toBeNull();
    expect(view.container.querySelectorAll("code").length).toBe(0);
    expect(view.container.querySelectorAll("pre").length).toBe(1);
    expect(view.container.querySelector("pre")?.textContent).toBe(source);
    expect(view.getByText(/block too large to color/)).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Copy code" }));
    await waitFor(() => expect(copyText).toHaveBeenCalledTimes(1));
    expect(copyText.mock.calls[0][0]).toBe(source);
  });

  test("a single enormous line is also plain, and a block just under the limits still highlights", () => {
    const huge = block(`const s = "${"a".repeat(HIGHLIGHT_LIMITS.blockChars)}";`, "ts");

    expect(huge.container.querySelector(".token")).toBeNull();
    cleanup();

    const lines = Array.from({ length: HIGHLIGHT_LIMITS.blockLines }, (_, i) => `const a${i} = 1;`);

    expect(block(lines.join("\n"), "ts").container.querySelector(".token.keyword")).not.toBeNull();
  });

  test("a diff line over the per-line limit is not tokenized but keeps its emphasis", () => {
    const text = `x = ${"1".repeat(HIGHLIGHT_LIMITS.lineChars)}`;
    const view = render(<HighlightedText emphasis={[0, 1]} language="typescript" text={text} />);

    expect(view.container.querySelector(".token")).toBeNull();
    expect(view.container.querySelector("[data-emphasis]")?.textContent).toBe("x");
    expect(view.container.textContent).toBe(text);
  });

  test("a grammar that throws falls back to the uncolored text instead of crashing", () => {
    function Boom(): never {
      throw new Error("grammar blew up");
    }
    const view = render(
      <HighlightBoundary fallback={<span data-testid="plain">plain text</span>}>
        <Boom />
      </HighlightBoundary>
    );

    expect(view.getByTestId("plain").textContent).toBe("plain text");
  });

  test("code is rendered as text, never as markup", () => {
    const view = block('<img src=x onerror="alert(1)"><script>alert(2)</script>', "html");

    expect(view.container.querySelector("img")).toBeNull();
    expect(view.container.querySelector("script")).toBeNull();
    expect(view.container.textContent).toContain("<script>alert(2)</script>");
  });
});
