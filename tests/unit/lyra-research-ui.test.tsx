import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";
import { FIXTURE_RESEARCH_REPORT } from "../fixtures/lyra-research";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { ResearchToolResult } from "@/components/chat/gen-ui/ResearchToolResult";
import { messagePartsToCopyMarkdown } from "@/lib/chat/message-copy-markdown";
import { GenUIBlockSchema } from "@/lib/schemas/gen-ui";

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("Lyra's browsable research", () => {
  test("renders synopses, takeaways, source scope and page evidence through the Gen UI registry", () => {
    const view = render(<GenUIRenderer data={{ block: FIXTURE_RESEARCH_REPORT }} />);
    expect(view.getByText(FIXTURE_RESEARCH_REPORT.title)).toBeTruthy();
    expect(view.getByText(FIXTURE_RESEARCH_REPORT.sources[0]!.synopsis)).toBeTruthy();
    expect(view.getByText(FIXTURE_RESEARCH_REPORT.sources[0]!.takeaways[0]!)).toBeTruthy();
    expect(view.getByText("Partial capture")).toBeTruthy();
    expect(view.getByText("Page 2")).toBeTruthy();
    expect(view.getByRole("link", { name: "Open original" }).getAttribute("rel")).toBe(
      "noopener noreferrer"
    );
  });

  test("loads saved text only when requested, reads more, and lets the user inspect an individual page", async () => {
    const fetcher = mock<typeof fetch>(async (input) => {
      const url = new URL(String(input), "http://localhost");
      const page = url.searchParams.get("page");
      const offset = Number(url.searchParams.get("offset"));
      return Response.json({
        sourceId: FIXTURE_RESEARCH_REPORT.sources[0]!.id,
        url: "https://example.com/study",
        sha256: "test-hash",
        offset,
        capturedChars: 24000,
        untrustedText: page ? "Page three table." : offset ? "Second portion." : "First portion.",
        nextOffset: page || offset ? null : 12000,
      });
    });
    globalThis.fetch = fetcher;
    const view = render(<GenUIRenderer data={FIXTURE_RESEARCH_REPORT} />);
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(view.getByText("Study methods and results", { selector: "span" }));
    fireEvent.click(view.getByRole("button", { name: "Read captured text" }));
    await waitFor(() => expect(view.getByDisplayValue("First portion.")).toBeTruthy());
    fireEvent.click(view.getByRole("button", { name: "Read more captured text" }));
    await waitFor(() =>
      expect(view.getByDisplayValue("First portion.Second portion.")).toBeTruthy()
    );
    fireEvent.change(view.getByLabelText("Document page"), { target: { value: "3" } });
    await waitFor(() => expect(view.getByDisplayValue("Page three table.")).toBeTruthy());
    expect(fetcher.mock.calls[2]![0]).toContain("page=3");
    expect(fetcher.mock.calls[0]![0]).toContain(
      `/api/chat/${FIXTURE_RESEARCH_REPORT.threadId}/research/sources/`
    );
  });

  test("shows a recoverable error when saved text is inaccessible", async () => {
    const fetcher = mock<typeof fetch>(async () => new Response("Forbidden", { status: 403 }));
    globalThis.fetch = fetcher;
    const view = render(<GenUIRenderer data={FIXTURE_RESEARCH_REPORT} />);
    fireEvent.click(view.getByText("Study methods and results", { selector: "span" }));
    fireEvent.click(view.getByRole("button", { name: "Read captured text" }));
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain("Could not load"));
    fireEvent.click(view.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  test("renders provider results and saved reports from tool outputs, and rejects unsafe links", () => {
    const source = FIXTURE_RESEARCH_REPORT.sources[0]!;
    const view = render(
      <ResearchToolResult
        toolName="research_read"
        output={{ saved: true, sources: [{ ...source, untrustedText: source.preview }] }}
        threadId={FIXTURE_RESEARCH_REPORT.threadId}
      />
    );
    expect(view.getByText("Pages read · 1")).toBeTruthy();
    expect(view.getByText(source.title, { selector: "span" })).toBeTruthy();
    cleanup();
    const report = render(
      <ResearchToolResult toolName="research_publish" output={{ block: FIXTURE_RESEARCH_REPORT }} />
    );
    expect(report.getByText(FIXTURE_RESEARCH_REPORT.title)).toBeTruthy();
    expect(
      GenUIBlockSchema.safeParse({
        ...FIXTURE_RESEARCH_REPORT,
        sources: [{ ...source, url: "javascript:alert(1)" }],
      }).success
    ).toBe(false);
  });

  test("copy includes the published synopsis, interpretation, quotations and original links", () => {
    const markdown = messagePartsToCopyMarkdown([
      {
        type: "dynamic-tool",
        toolName: "research_publish",
        toolCallId: "published",
        state: "output-available",
        input: {},
        output: { block: FIXTURE_RESEARCH_REPORT },
      },
    ]);
    expect(markdown).toContain(FIXTURE_RESEARCH_REPORT.sources[0]!.synopsis);
    expect(markdown).toContain("Lyra’s takeaways");
    expect(markdown).toContain("https://example.com/study");
    expect(markdown).toContain("page 2");
  });
});
