import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import { LauncherIdeaCard } from "@/components/aion-launcher/launcher-idea-card";
import type { LauncherIdea } from "@/lib/launcher/launcher-ideas";
import type { SessionSignal } from "@/lib/sidebar/session-signal";
import { render } from "../helpers/render";

afterEach(cleanup);

const NOW = Date.parse("2026-11-11T12:00:00.000Z");

const IDEA: LauncherIdea = {
  id: "t1",
  title: "Ergon intake",
  href: "/chat/t1",
  feature: undefined,
  date: "2026-11-11T10:00:00.000Z",
  cue: "Choosing automatic capture or explicit saving",
};

function renderCard(overrides?: {
  idea?: Partial<LauncherIdea>;
  signal?: SessionSignal;
  onOpen?: (idea: LauncherIdea) => void;
}) {
  const onOpen = overrides?.onOpen ?? mock(() => {});

  return {
    onOpen,
    ...render(
      <LauncherIdeaCard
        idea={{ ...IDEA, ...overrides?.idea }}
        index={0}
        likely={false}
        now={NOW}
        signal={overrides?.signal ?? { kind: "idle" }}
        tabbable
        onFocusCard={() => {}}
        onOpen={onOpen}
      />
    ),
  };
}

describe("LauncherIdeaCard", () => {
  test("shows the title, the resume cue and the age, and opens on click", () => {
    const { getByRole, getByText, onOpen } = renderCard();

    expect(getByText("Ergon intake")).toBeTruthy();
    expect(getByText("Choosing automatic capture or explicit saving")).toBeTruthy();
    expect(getByText("2h")).toBeTruthy();

    fireEvent.click(getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect((onOpen as ReturnType<typeof mock>).mock.calls[0][0]).toMatchObject({ id: "t1" });
  });

  test("a missing cue leaves the card complete and keeps its height reserved", () => {
    const { container, getByText } = renderCard({ idea: { cue: null } });

    expect(getByText("Ergon intake")).toBeTruthy();
    const cue = container.querySelector(".min-h-8");

    expect(cue).not.toBeNull();
    expect(cue!.className).toContain("opacity-0");
  });

  test("idle is lights out: no status word, no New", () => {
    const { container, queryByText } = renderCard();

    expect(container.querySelector("button")!.getAttribute("data-session-signal")).toBe("idle");
    expect(queryByText("New")).toBeNull();
  });

  test("working names the work", () => {
    const { getByText } = renderCard({ signal: { kind: "working", step: null } });

    expect(getByText("Responding")).toBeTruthy();
  });

  test("new says so, in text as well as colour", () => {
    const { getByText, container } = renderCard({ signal: { kind: "new" } });

    expect(getByText("New")).toBeTruthy();
    expect(container.querySelector("button")!.getAttribute("data-session-signal")).toBe("new");
  });

  test("only the tabbable card is in the tab order", () => {
    const { container } = render(
      <LauncherIdeaCard
        idea={IDEA}
        index={1}
        likely={false}
        now={NOW}
        signal={{ kind: "idle" }}
        tabbable={false}
        onFocusCard={() => {}}
        onOpen={() => {}}
      />
    );

    expect(container.querySelector("button")!.getAttribute("tabindex")).toBe("-1");
  });
});
