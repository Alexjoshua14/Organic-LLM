import { describe, expect, test } from "bun:test";

import {
  isNavigationAction,
  moveFocusedTaskIndex,
  resolveTaskRowKeyAction,
} from "@/lib/ergon/task-row-keyboard";

function key(k: string, expanded = false) {
  return resolveTaskRowKeyAction({
    key: k,
    expanded,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
  });
}

describe("resolveTaskRowKeyAction", () => {
  test("navigation keys", () => {
    expect(key("ArrowDown")).toBe("next");
    expect(key("j")).toBe("next");
    expect(key("ArrowUp")).toBe("prev");
    expect(key("k")).toBe("prev");
    expect(key("Home")).toBe("first");
    expect(key("End")).toBe("last");
  });

  test("action keys", () => {
    expect(key("Enter")).toBe("toggleExpand");
    expect(key(" ")).toBe("complete");
    expect(key("a")).toBe("active");
    expect(key("A")).toBe("active");
    expect(key("e")).toBe("edit");
    expect(key("Delete")).toBe("delete");
    expect(key("Backspace")).toBe("delete");
    expect(key("c")).toBe("chatAbout");
  });

  test("Escape collapses only when expanded", () => {
    expect(key("Escape", true)).toBe("collapse");
    expect(key("Escape", false)).toBeNull();
  });

  test("modifier combos are ignored (browser/app shortcuts win)", () => {
    expect(
      resolveTaskRowKeyAction({
        key: "a",
        expanded: false,
        metaKey: true,
        ctrlKey: false,
        altKey: false,
      })
    ).toBeNull();
  });

  test("unmapped keys return null", () => {
    expect(key("x")).toBeNull();
    expect(key("Tab")).toBeNull();
  });
});

describe("isNavigationAction", () => {
  test("classifies movement vs mutation", () => {
    expect(isNavigationAction("next")).toBe(true);
    expect(isNavigationAction("last")).toBe(true);
    expect(isNavigationAction("complete")).toBe(false);
    expect(isNavigationAction("delete")).toBe(false);
  });
});

describe("moveFocusedTaskIndex", () => {
  test("next clamps at the end", () => {
    expect(moveFocusedTaskIndex(0, "next", 3)).toBe(1);
    expect(moveFocusedTaskIndex(2, "next", 3)).toBe(2);
  });

  test("prev clamps at the start", () => {
    expect(moveFocusedTaskIndex(2, "prev", 3)).toBe(1);
    expect(moveFocusedTaskIndex(0, "prev", 3)).toBe(0);
  });

  test("home and end jump to bounds", () => {
    expect(moveFocusedTaskIndex(2, "first", 5)).toBe(0);
    expect(moveFocusedTaskIndex(0, "last", 5)).toBe(4);
  });

  test("empty list returns -1", () => {
    expect(moveFocusedTaskIndex(0, "next", 0)).toBe(-1);
  });
});
