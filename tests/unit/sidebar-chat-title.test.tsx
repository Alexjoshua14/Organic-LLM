import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { SidebarChatTitle } from "@/components/sidebar/sidebar-chat-title";

const GRADIENT_TITLE =
  "bg-linear-to-tr from-emerald-600/85 via-foreground-secondary to-foreground-secondary bg-clip-text text-transparent";

describe("SidebarChatTitle", () => {
  afterEach(cleanup);

  test("gradient titles keep their text directly inside the clipped title line", () => {
    // Regression: wrapping the text in an animated (filtered) element made Arcadia titles
    // invisible — `bg-clip-text` on the heading cannot paint a child on its own layer.
    const view = render(
      <SidebarChatTitle
        threadId="thread-arcadia"
        className={GRADIENT_TITLE}
        editing={false}
        title="Arcadia run"
        onSave={() => {}}
      />
    );

    const heading = view.getByRole("heading", { name: "Arcadia run" });

    const line = heading.querySelector(".thread-title-line");

    expect(line?.className).toContain("bg-clip-text");
    expect(line?.childNodes).toHaveLength(1);
    expect(line?.firstChild?.nodeType).toBe(Node.TEXT_NODE);
  });

  test("a changed title replaces the heading and still renders its text", () => {
    const view = render(
      <SidebarChatTitle
        threadId="thread-arcadia"
        editing={false}
        title="Old title"
        onSave={() => {}}
      />
    );

    view.rerender(
      <SidebarChatTitle
        threadId="thread-arcadia"
        editing={false}
        title="New title"
        onSave={() => {}}
      />
    );

    expect(view.getByRole("heading", { name: "New title" })).toBeDefined();
    expect(view.queryByText("Old title")).toBeNull();
  });
});
