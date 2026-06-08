import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";

import { BlockNotepadSurface } from "@/components/strata/notepad/BlockNotepadSurface";
import { render } from "../helpers/render";

afterEach(() => cleanup());

describe("BlockNotepadSurface", () => {
  test("add text block button pushes block update", () => {
    const onBlocksChange = mock(() => {});
    const { getByText } = render(
      <BlockNotepadSurface
        blocks={[
          {
            id: "00000000-0000-4000-8000-000000000001",
            type: "text",
            text: "hello",
          },
        ]}
        onBlocksChange={onBlocksChange}
        onProcessLink={async () => ({ title: "x", summary: "y" })}
      />
    );

    fireEvent.click(getByText("Add text block"));
    expect(onBlocksChange).toHaveBeenCalled();
  });

  test("link block shows resolved summary after confirm", async () => {
    let blocks = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        type: "link" as const,
        url: "https://example.com",
        state: "idle" as const,
      },
    ];
    const onBlocksChange = mock((next: typeof blocks) => {
      blocks = next;
    });
    const onProcessLink = mock(async ({ onStatus }: { onStatus: (m: string) => void }) => {
      onStatus("Fetching content");
      return { title: "Example", summary: "Short summary." };
    });
    const { getByText, rerender } = render(
      <BlockNotepadSurface
        blocks={blocks}
        onBlocksChange={onBlocksChange}
        onProcessLink={onProcessLink}
      />
    );

    fireEvent.click(getByText("Confirm search"));
    await waitFor(() => expect(onProcessLink).toHaveBeenCalled());
    rerender(
      <BlockNotepadSurface
        blocks={blocks}
        onBlocksChange={onBlocksChange}
        onProcessLink={onProcessLink}
      />
    );
    await waitFor(() => expect(getByText("Short summary.")).toBeTruthy());
  });
});
