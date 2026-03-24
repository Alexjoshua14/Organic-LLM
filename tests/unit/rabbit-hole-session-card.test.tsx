import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup } from "@testing-library/react";
import type { HTMLAttributes } from "react";

import { render } from "../helpers/render";

mock.module("framer-motion", () => ({
  motion: {
    div: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  },
}));

import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";
import { SessionCard } from "@/components/rabbit-holes/SessionCard";
import { RABBIT_HOLE_UNTITLED } from "@/lib/rabbit-holes/constants";

const iso = "2025-06-10T15:00:00.000Z";

function baseSession(overrides: Partial<RabbitHoleSessionMetadata> = {}): RabbitHoleSessionMetadata {
  return {
    sessionId: "sess-1",
    rootQuestion: "USER_QUESTION_SHOULD_NOT_APPEAR_AS_HEADING",
    createdAt: iso,
    updatedAt: iso,
    pathLength: 2,
    ...overrides,
  };
}

describe("SessionCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows trimmed rootTitle as heading when set", () => {
    const { getByRole } = render(
      <SessionCard session={baseSession({ rootTitle: "  Generated title  " })} showDelete={false} />,
    );

    expect(getByRole("heading", { level: 3 }).textContent).toBe("Generated title");
  });

  test("shows Untitled when rootTitle missing and does not use rootQuestion", () => {
    const { getByRole, queryByText } = render(
      <SessionCard session={baseSession()} showDelete={false} />,
    );

    expect(getByRole("heading", { level: 3 }).textContent).toBe(RABBIT_HOLE_UNTITLED);
    expect(queryByText("USER_QUESTION_SHOULD_NOT_APPEAR_AS_HEADING")).toBeNull();
  });
});
