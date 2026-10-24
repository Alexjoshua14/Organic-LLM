import { describe, expect, test } from "bun:test";
import { render, within } from "@testing-library/react";

import { ContextBudgetIndicatorView } from "@/components/chat/context-budget-indicator";
import { computeNewThreadDefaultBudget } from "@/lib/chat/context-budget";
import { ensureDom } from "../helpers/render";

ensureDom();

const budget = computeNewThreadDefaultBudget({ modelId: "openai/gpt-6-sol" });

describe("ContextBudgetIndicatorView draft count", () => {
  test("is a bare ring while nothing is typed", () => {
    const view = render(<ContextBudgetIndicatorView budget={budget} />);
    const badge = within(view.container).getByRole("button");

    expect(badge.textContent).toBe("");
    expect(badge.getAttribute("aria-label")).not.toContain("your message");
    view.unmount();
  });

  test("shows the typed message's tokens beside the ring, compact past 10k", () => {
    const view = render(<ContextBudgetIndicatorView budget={budget} draftTokens={1_240} />);
    const badge = within(view.container).getByRole("button");

    expect(badge.textContent).toBe("1,240 tok");
    expect(badge.getAttribute("aria-label")).toContain("your message about 1,240 tokens");

    view.rerender(<ContextBudgetIndicatorView budget={budget} draftTokens={12_400} />);
    expect(badge.textContent).toBe("12k tok");
    view.unmount();
  });
});
