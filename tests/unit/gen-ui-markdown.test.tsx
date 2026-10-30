import { afterEach, describe, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";

import { AnswerCard } from "@/components/chat/gen-ui/blocks/AnswerCard";
import { GenUIMarkdown, preserveLineBreaks } from "@/components/chat/gen-ui/GenUIMarkdown";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import type { AnswerCardBlock } from "@/lib/schemas/gen-ui";
import { render } from "../helpers/render";

afterEach(cleanup);

const MARKDOWN_ANSWER_CARD: AnswerCardBlock = {
  type: "answer-card",
  version: 1,
  title: "heapq",
  tldr: "Use **heapq** for a `min-heap`.",
  keyPoints: ["**`heappush`** is O(log n).", "`heapify(list)` is O(n)."],
  sections: [
    {
      heading: "1. `heapq` (priority queue)",
      body: [
        "- Min-heap stored in a normal list. `heap[0]` peeks the min.",
        "- **No max-heap:** push negated values.",
        "",
        "**Deeper:** a size-k heap is O(n log k).",
      ].join("\n"),
      defaultOpen: true,
    },
  ],
  footer: { confidence: "high", caveats: ["Not thread-safe; see `queue.PriorityQueue`."] },
};

/** No markdown syntax should survive as visible text. */
function expectNoRawMarkdown(text: string | null) {
  expect(text).not.toContain("**");
  expect(text).not.toContain("`");
}

describe("AnswerCard markdown", () => {
  test("renders bold, inline code, and bold code instead of raw syntax", () => {
    const { container } = render(<AnswerCard block={MARKDOWN_ANSWER_CARD} />);

    expectNoRawMarkdown(container.textContent);
    expect(container.querySelector("strong code")?.textContent).toBe("heappush");
    expect([...container.querySelectorAll("code")].map((c) => c.textContent)).toContain(
      "queue.PriorityQueue"
    );
  });

  test("renders a section body's list and paragraphs as elements", () => {
    const { container } = render(<AnswerCard block={MARKDOWN_ANSWER_CARD} />);
    const items = container.querySelectorAll("details ul > li");

    expect(items.length).toBe(2);
    expect(items[1]?.querySelector("strong")?.textContent).toBe("No max-heap:");
    expect(container.querySelector("details p strong")?.textContent).toBe("Deeper:");
  });

  test("renders a streaming section that has no body yet", () => {
    const partial = {
      ...MARKDOWN_ANSWER_CARD,
      sections: [{ heading: "Streaming" }],
    } as unknown as AnswerCardBlock;
    const { getByText } = render(<AnswerCard block={partial} partial />);

    expect(getByText("Streaming")).toBeTruthy();
  });
});

describe("GenUIMarkdown", () => {
  test("inline mode keeps only inline marks and unwraps paragraphs", () => {
    const { container } = render(
      <p>
        <GenUIMarkdown inline>{"one **two**\n\n- three"}</GenUIMarkdown>
      </p>
    );

    expect(container.querySelectorAll("p").length).toBe(1);
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("two");
  });

  test("links open in a new tab", () => {
    const { container } = render(
      <GenUIMarkdown inline>{"[docs](https://example.com)"}</GenUIMarkdown>
    );
    const link = container.querySelector("a");

    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("block paragraphs inherit the card's text size over the global <p> style", () => {
    const { container } = render(<GenUIMarkdown className="text-sm">{"para"}</GenUIMarkdown>);
    const className = container.querySelector("p")?.className ?? "";

    // `globals.css` sets `p { text-base }`; without these the paragraph outgrows its list items.
    expect(className).toContain("text-[length:inherit]");
    expect(className).toContain("leading-[inherit]");
  });

  test("block mode keeps single newlines as line breaks", () => {
    const { container } = render(<GenUIMarkdown>{"line one\nline two"}</GenUIMarkdown>);

    expect(container.querySelector("p br")).toBeTruthy();
  });
});

describe("preserveLineBreaks", () => {
  test("adds hard breaks between single-newline lines", () => {
    expect(preserveLineBreaks("a\nb")).toBe("a  \nb");
  });

  test("leaves blank lines and list items alone", () => {
    expect(preserveLineBreaks("a\n\nb")).toBe("a\n\nb");
    expect(preserveLineBreaks("- a\n- b")).toBe("- a  \n- b");
  });

  test("leaves fenced code byte-for-byte", () => {
    const fence = "```py\nx = 1\ny = 2\n```";

    expect(preserveLineBreaks(`intro\n${fence}\nafter\nmore`)).toBe(
      `intro\n${fence}\nafter  \nmore`
    );
  });
});

describe("chat inline code", () => {
  test("drops prose's decorative backticks and inherits bold weight", () => {
    const { container } = render(<ChatMessageMarkdown content={"**`pop(0)`:** O(n)"} id="m1" />);
    const code = container.querySelector("strong code");

    expect(code?.textContent).toBe("pop(0)");
    expect(code?.className).toContain("before:content-none");
    expect(code?.className).toContain("after:content-none");
    expect(code?.className).toContain("[font-weight:inherit]");
  });
});
