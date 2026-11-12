import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";

import { render } from "../helpers/render";

import { ChoicePicker } from "@/components/design-system/choice-picker";

const groups = [
  {
    label: "Components",
    options: [
      { value: "answer", label: "Answer", description: "Read a complete answer" },
      { value: "comparison", label: "Comparison", description: "Explore the tradeoffs" },
    ],
  },
  {
    label: "Rendering",
    options: [
      { value: "streaming", label: "Streaming", description: "Preview a response arriving" },
      { value: "disabled", label: "Unavailable", disabled: true },
    ],
  },
];

function Example() {
  const [value, setValue] = useState("answer");
  return <ChoicePicker label="View" value={value} onValueChange={setValue} groups={groups} />;
}

afterEach(cleanup);

describe("ChoicePicker", () => {
  test("keyboard opens grouped radio choices, selection updates trigger and restores focus", async () => {
    const view = render(<Example />);
    const trigger = view.getByRole("button", { name: "View: Answer" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const choice = await view.findByRole("menuitemradio", { name: /Comparison/ });
    expect(view.getByText("Components")).toBeTruthy();
    expect(view.getByText("Rendering")).toBeTruthy();
    expect(view.getByRole("menuitemradio", { name: /Answer/ }).getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(
      view.getByRole("menuitemradio", { name: "Unavailable" }).getAttribute("aria-disabled")
    ).toBe("true");
    choice.focus();
    fireEvent.keyDown(choice, { key: "Enter" });
    await waitFor(() =>
      expect(view.getByRole("button", { name: "View: Comparison" })).toBeTruthy()
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  test("Escape closes without changing the selection", async () => {
    const view = render(<Example />);
    const trigger = view.getByRole("button", { name: "View: Answer" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = await view.findByRole("menu");
    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => expect(view.queryByRole("menu")).toBeNull());
    expect(view.getByRole("button", { name: "View: Answer" })).toBeTruthy();
  });
});
