import { describe, expect, test, afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GenUISkeleton } from "@/components/chat/gen-ui/GenUISkeleton";
import { render } from "../helpers/render";
import {
  FIXTURE_ANSWER_CARD,
  FIXTURE_INVALID_BLOCK,
} from "@/lib/schemas/gen-ui/fixtures";

afterEach(() => cleanup());

describe("GenUIRenderer", () => {
  test("renders answer card for valid tool output", () => {
    const { getByText } = render(
      <GenUIRenderer data={{ block: FIXTURE_ANSWER_CARD }} messageId="t1" />
    );
    expect(getByText(FIXTURE_ANSWER_CARD.title)).toBeTruthy();
    expect(getByText(/Summary/)).toBeTruthy();
  });

  test("falls back to markdown for invalid block", () => {
    const { getByText } = render(<GenUIRenderer data={FIXTURE_INVALID_BLOCK} messageId="t2" />);
    expect(getByText(/Bad version|structured block/i)).toBeTruthy();
  });
});

describe("GenUISkeleton", () => {
  test("streaming partial shows skeleton with type label", () => {
    const { getByLabelText } = render(
      <GenUISkeleton
        partialInput={{ type: "plan-timeline", title: "Loading plan" }}
        type="plan-timeline"
      />
    );
    expect(getByLabelText(/Loading structured response/i)).toBeTruthy();
  });
});
