import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";

import { render } from "../helpers/render";

import { ErgonBoardLab } from "@/app/sandbox/prototypes/ergon/_components/ErgonBoardLab";
import { ergonBoardLabLayout } from "@/app/sandbox/prototypes/ergon/_components/ergon-board-lab-layout";

beforeAll(() => {
  if (typeof globalThis.IntersectionObserver === "undefined") {
    globalThis.IntersectionObserver = class {
      root = null;
      rootMargin = "";
      thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }
});

afterEach(() => cleanup());

describe("ErgonBoardLab mobile chrome", () => {
  test("exposes stacked chrome tokens and transport controls", () => {
    const { getByLabelText, getByRole, getByText, queryByLabelText } = render(<ErgonBoardLab />);

    expect(ergonBoardLabLayout.chrome).toContain("max-[720px]:flex-col");
    expect(ergonBoardLabLayout.widthControl).toContain("hidden");
    expect(ergonBoardLabLayout.boardFrame).toContain("min-w-0");

    expect(getByText("Board")).toBeTruthy();
    expect(getByLabelText("Light")).toBeTruthy();
    expect(getByRole("button", { name: "Compare all" })).toBeTruthy();
    expect(getByLabelText("Send next command")).toBeTruthy();
    expect(getByLabelText("Restart")).toBeTruthy();
    // Autoplay starts unless reduced-motion; either transport label is fine.
    expect(queryByLabelText("Play") ?? queryByLabelText("Pause")).toBeTruthy();
  });
});
