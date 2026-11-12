import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, within } from "@testing-library/react";

import { render } from "../helpers/render";

import type { ShoppingListBlock } from "@/lib/schemas/gen-ui";

import { ShoppingList } from "@/components/chat/gen-ui/blocks/ShoppingList";

afterEach(cleanup);

function makeBlock(title = "Weeknight shop"): ShoppingListBlock {
  return {
    type: "shopping-list",
    version: 1,
    title,
    groups: [
      {
        category: "Produce",
        items: [
          { name: "Lemons", quantity: "3", status: "need" },
          { name: "Garlic", status: "have", checked: false },
        ],
      },
      { category: "Dairy", items: [{ name: "Butter", status: "need", checked: true }] },
    ],
  } as ShoppingListBlock;
}

describe("ShoppingList without a controlling caller", () => {
  test("checkboxes work: ticking an item updates its state, label and the still-to-buy count", () => {
    const view = render(<ShoppingList block={makeBlock()} />);
    const card = within(view.container);

    expect(card.getByText("1 still to buy")).toBeTruthy();

    const lemons = card.getAllByRole("button", { name: "Mark as picked up" })[0]!;

    fireEvent.click(lemons);
    expect(card.getByText("0 still to buy")).toBeTruthy();
    expect(card.getAllByRole("button", { pressed: true })).toHaveLength(2);

    fireEvent.click(card.getAllByRole("button", { name: "Mark as not picked up" })[0]!);
    expect(card.getByText("1 still to buy")).toBeTruthy();
  });

  test("the have/need pill toggles locally and changes the count", () => {
    const view = render(<ShoppingList block={makeBlock()} />);
    const card = within(view.container);

    fireEvent.click(card.getByRole("button", { name: "have" }));
    expect(card.queryByRole("button", { name: "have" })).toBeNull();
    expect(card.getAllByRole("button", { name: "need" })).toHaveLength(3);
    expect(card.getByText("2 still to buy")).toBeTruthy();
  });

  test("a different block never inherits ticks made on the previous one", () => {
    const view = render(<ShoppingList block={makeBlock()} />);
    const card = within(view.container);

    fireEvent.click(card.getAllByRole("button", { name: "Mark as picked up" })[0]!);
    expect(card.getByText("0 still to buy")).toBeTruthy();

    view.rerender(<ShoppingList block={makeBlock("Regenerated")} />);
    expect(card.getByText("1 still to buy")).toBeTruthy();
  });

  test("a streaming (partial) list stays read-only", () => {
    const view = render(<ShoppingList block={makeBlock()} partial />);

    expect(within(view.container).queryAllByRole("button")).toHaveLength(0);
  });
});

describe("ShoppingList controlled by a caller", () => {
  test("reports the toggle with its position and leaves the state to the caller", () => {
    const onToggleChecked = mock();
    const onToggleStatus = mock();
    const view = render(
      <ShoppingList
        block={makeBlock()}
        onToggleChecked={onToggleChecked}
        onToggleStatus={onToggleStatus}
      />
    );
    const card = within(view.container);

    fireEvent.click(card.getAllByRole("button", { name: "Mark as picked up" })[0]!);
    expect(onToggleChecked).toHaveBeenCalledWith({ groupIndex: 0, itemIndex: 0 });
    // The block did not change, so a controlled list does not tick itself.
    expect(card.getByText("1 still to buy")).toBeTruthy();
    expect(card.getAllByRole("button", { pressed: true })).toHaveLength(1);

    fireEvent.click(card.getByRole("button", { name: "have" }));
    expect(onToggleStatus).toHaveBeenCalledWith({ groupIndex: 0, itemIndex: 1 });
    expect(card.getByRole("button", { name: "have" })).toBeTruthy();
  });
});
