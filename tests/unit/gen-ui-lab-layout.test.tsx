import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import { installBrowserMedia } from "../helpers/browser-media";
import { render } from "../helpers/render";

import {
  GenUiDecisionDemoToolbar,
  useGenUiDecisionDemo,
} from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiDecisionDemo";
import { GenUiGalleryNav } from "@/app/sandbox/prototypes/gen-ui-lab/_components/GenUiGalleryNav";

let restoreMedia: () => void;

beforeEach(() => {
  restoreMedia = installBrowserMedia();
});

afterEach(() => {
  cleanup();
  restoreMedia();
});

function Toolbar() {
  return <GenUiDecisionDemoToolbar demo={useGenUiDecisionDemo(true)} />;
}

describe("Gen UI Lab layout", () => {
  test("gallery dots take keyboard focus without a ring and open their label", () => {
    const view = render(
      <GenUiGalleryNav
        activeIndex={0}
        count={2}
        labels={["One", "Two"]}
        onSelectIndex={() => {}}
      />
    );
    const dot = view.getByRole("button", { name: "Two" });

    expect(dot.className).not.toMatch(/outline-2|ring/);
    expect(dot.className).toContain("focus-visible:outline-none");
    fireEvent.focus(dot);
    expect(dot.querySelector(".gen-ui-gallery-nav__label")).not.toBeNull();
  });

  test("the arrangement toolbar reserves its intent lines so the arrows cannot move", () => {
    const view = render(<Toolbar />);
    const next = view.getByRole("button", { name: "Next arrangement" });
    const intent = view.container.querySelector("p.line-clamp-2");

    expect(intent?.className).toContain("min-h-10");
    expect(next.className).toContain("focus-visible:bg-foreground");
    expect(next.className).not.toMatch(/ring/);
  });
});
