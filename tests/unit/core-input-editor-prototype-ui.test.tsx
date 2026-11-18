import { beforeEach, afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { RichComposer } from "@/app/sandbox/prototypes/core-input/_components/editor-prototype/rich-composer";

import { installBrowserMedia } from "../helpers/browser-media";

let restoreMedia: () => void;
beforeEach(() => {
  restoreMedia = installBrowserMedia();
});
afterEach(() => {
  cleanup();
  restoreMedia();
});

describe("CoreInput prototype mode switching", () => {
  test("source survives a formatted inspection, sends exactly, and can be restored after editing", async () => {
    const sent: string[] = [];
    const ui = render(
      <RichComposer
        busy={false}
        toolsOpen
        initialMarkdown="A draft"
        voice={false}
        onSend={(text) => sent.push(text)}
        onStop={() => {}}
      />
    );

    await ui.findByRole("textbox", { name: "Prototype message" });
    await waitFor(() =>
      expect(
        ui.getByRole("button", { name: "Edit Markdown source" }).hasAttribute("disabled")
      ).toBe(false)
    );
    fireEvent.click(ui.getByRole("button", { name: "Edit Markdown source" }));
    const original = "**Keep**  this spacing\n\n<!-- retain this comment -->";

    fireEvent.change(ui.getByRole("textbox", { name: "Markdown source" }), {
      target: { value: original },
    });
    fireEvent.click(ui.getByRole("button", { name: "Return to formatted editing" }));
    fireEvent.click(ui.getByRole("button", { name: "Send prototype message" }));
    expect(sent).toEqual([original]);
    fireEvent.click(ui.getByRole("button", { name: "Edit Markdown source" }));
    expect(
      (ui.getByRole("textbox", { name: "Markdown source" }) as HTMLTextAreaElement).value
    ).toBe(original);
    fireEvent.change(ui.getByRole("textbox", { name: "Markdown source" }), {
      target: { value: "Another draft" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Restore source snapshot" }));
    expect(
      (ui.getByRole("textbox", { name: "Markdown source" }) as HTMLTextAreaElement).value
    ).toBe(original);
  });

  test("voice presentation keeps the same editor DOM and draft", async () => {
    const props = {
      busy: false,
      initialMarkdown: "An unsent thought",
      onSend: () => {},
      onStop: () => {},
    };
    const ui = render(<RichComposer {...props} voice={false} />);

    const textbox = await ui.findByRole("textbox", { name: "Prototype message" });

    ui.rerender(<RichComposer {...props} voice />);
    expect(ui.getByText("Listening · simulated")).toBeTruthy();
    ui.rerender(<RichComposer {...props} voice={false} />);
    expect(ui.getByRole("textbox", { name: "Prototype message" })).toBe(textbox);
    expect(textbox.textContent).toContain("An unsent thought");
  });
});

test("multiline code uses shared code chrome and serializes only the edited code", async () => {
  const sent: string[] = [];
  const ui = render(
    <RichComposer
      busy={false}
      initialMarkdown={"```ts\nconst a = 1;\nconst b = 2;\n```"}
      voice={false}
      onSend={(text) => sent.push(text)}
      onStop={() => {}}
    />
  );
  const language = await ui.findByRole("combobox", { name: "Code block language" });

  fireEvent.change(language, { target: { value: "python" } });
  fireEvent.click(ui.getByRole("button", { name: "Send prototype message" }));
  expect(sent[0]).toContain("```python\nconst a = 1;\nconst b = 2;\n```");
  expect(sent[0]).not.toContain("Copy code");
  expect(ui.container.querySelector(".editor-code-block .organic-code")).not.toBeNull();
});

test("Shift+Enter inserts repeated newlines inside code instead of exiting or sending", async () => {
  const sent: string[] = [];
  const ui = render(
    <RichComposer
      busy={false}
      initialMarkdown={"```ts\nconst first = 1;\n```"}
      voice={false}
      onSend={(text) => sent.push(text)}
      onStop={() => {}}
    />
  );
  const textbox = await ui.findByRole("textbox", { name: "Prototype message" });

  for (let index = 0; index < 3; index += 1) {
    fireEvent.keyDown(textbox, { key: "Enter", code: "Enter", shiftKey: true });
  }
  expect(ui.container.querySelectorAll(".editor-code-block").length).toBe(1);
  expect(ui.container.querySelector(".editor-code-body")?.textContent).toBe(
    "\n\n\nconst first = 1;"
  );
  expect(sent).toEqual([]);
});

test("the composer is one line until the text needs structure, then stacks", async () => {
  const ui = render(
    <RichComposer
      busy={false}
      initialMarkdown=""
      voice={false}
      leading={<button type="button">Options</button>}
      trailing={<button type="button">Attach</button>}
      onSend={() => {}}
      onStop={() => {}}
    />
  );
  await ui.findByRole("textbox", { name: "Prototype message" });
  const row = ui.container.querySelector(".editor-row");

  expect(row?.getAttribute("data-expanded")).toBe("false");
  expect(row?.querySelector("[data-reflow='lead']")?.textContent).toBe("Options");
  expect(row?.querySelector("[data-reflow='trail']")?.textContent).toBe("Attach");
  expect(row?.querySelector("[data-reflow='send']")).not.toBeNull();

  // Live voice and Markdown source need the full width, so they stack the composer.
  ui.rerender(
    <RichComposer busy={false} initialMarkdown="" voice onSend={() => {}} onStop={() => {}} />
  );
  await waitFor(() =>
    expect(ui.container.querySelector(".editor-row")?.getAttribute("data-expanded")).toBe("true")
  );
});
