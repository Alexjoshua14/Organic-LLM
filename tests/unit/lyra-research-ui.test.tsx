import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { render } from "../helpers/render";
import { FIXTURE_RESEARCH_REPORT } from "../fixtures/lyra-research";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { ResearchReport } from "@/components/chat/gen-ui/blocks/ResearchReport";
import { ResearchToolResult } from "@/components/chat/gen-ui/ResearchToolResult";
import { messagePartsToCopyMarkdown } from "@/lib/chat/message-copy-markdown";
import { GenUIBlockSchema } from "@/lib/schemas/gen-ui";

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("Lyra's browsable research", () => {
  test("shows reused source notes as inspectable text and identifies saved source reuse", () => {
    const notes = render(
      <ResearchToolResult
        toolName="research_annotations"
        output={{
          annotations: [
            {
              sourceId: "src-a",
              reused: true,
              synopsis: "Saved article synopsis",
              takeaways: ["Review its methods"],
              generatedAt: "2026-10-10T12:00:00.000Z",
            },
            { sourceId: "src-b", reused: false },
          ],
        }}
      />
    );
    expect(notes.getByText("Saved article synopsis")).toBeTruthy();
    expect(notes.getByText("Review its methods")).toBeTruthy();
    expect(notes.getByText("No reusable notes for this source and assignment.")).toBeTruthy();
    cleanup();
    const source = render(
      <ResearchToolResult
        toolName="research_read"
        output={{ cache: { hits: 1, providerCalls: 0 }, sources: [] }}
      />
    );
    expect(
      source.getByText("Reused 1 saved source. Original capture dates appear below.")
    ).toBeTruthy();
  });
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

  test("finding source controls open the exact captured source without fetching it", async () => {
    const fetcher = mock<typeof fetch>(
      async () => new Response("Unexpected request", { status: 500 })
    );
    globalThis.fetch = fetcher;
    const second = {
      ...FIXTURE_RESEARCH_REPORT.sources[0]!,
      id: "second-source",
      title: "Second captured document",
      url: "https://example.com/second",
    };
    const report = {
      ...FIXTURE_RESEARCH_REPORT,
      sources: [second, ...FIXTURE_RESEARCH_REPORT.sources],
    };
    const view = render(<ResearchReport block={report} />);
    const target = view
      .getByText("Study methods and results", { selector: "span" })
      .closest("details")!;
    const unrelated = view
      .getByText("Second captured document", { selector: "span" })
      .closest("details")!;

    expect(target.open).toBe(false);
    fireEvent.click(view.getByRole("button", { name: "Inspect source 2" }));
    await waitFor(() => expect(target.open).toBe(true));
    expect(unrelated.open).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(view.getByText(report.claims[0]!.assessment).closest("details")).toBeNull();
  });

  test("unknown source references remain explicit and cannot open an unrelated source", () => {
    const claim = FIXTURE_RESEARCH_REPORT.claims[0]!;
    const report = {
      ...FIXTURE_RESEARCH_REPORT,
      claims: [
        {
          ...claim,
          issues: ["missing_source" as const],
          evidence: [{ ...claim.evidence[0]!, sourceId: "missing-source", url: undefined }],
        },
      ],
    };
    const view = render(<ResearchReport block={report} />);

    expect(view.getByText("Source unavailable · missing-source")).toBeTruthy();
    expect(view.queryByRole("button", { name: /Inspect source/ })).toBeNull();
    expect(view.getByText("Source unavailable")).toBeTruthy();
    expect(view.queryByText("Quotes match captured sources")).toBeNull();
  });

  test("empty and partial reports explain unavailable evidence without claiming quote verification", () => {
    const empty = { ...FIXTURE_RESEARCH_REPORT, sources: [], claims: [] };
    const view = render(<ResearchReport block={empty} partial />);

    expect(view.getByText("Findings are still arriving.")).toBeTruthy();
    expect(view.getByText("Sources are still arriving.")).toBeTruthy();
    expect(view.queryByText("Quotes match captured sources")).toBeNull();
    cleanup();
    const noEvidence = render(
      <ResearchReport
        block={{
          ...empty,
          claims: [{ ...FIXTURE_RESEARCH_REPORT.claims[0]!, issues: [], evidence: [] }],
        }}
      />
    );

    expect(noEvidence.getByText("No evidence has been attached to this claim.")).toBeTruthy();
    expect(noEvidence.queryByText("Quotes match captured sources")).toBeNull();
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
