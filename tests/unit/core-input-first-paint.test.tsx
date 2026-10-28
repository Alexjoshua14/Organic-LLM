import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import * as personaSession from "@/components/personas/persona-session-provider";

import { mockModulePreservingReal } from "../helpers/module-mock";

/**
 * CoreInput's server-rendered first paint must match the hydrated layout. The server can't
 * size the textarea or know the persona session, so both hold their final space up front.
 */

let personaValue: ReturnType<typeof personaSession.usePersonaSessionOptional> = null;

const restorePersona = mockModulePreservingReal(
  "@/components/personas/persona-session-provider",
  personaSession,
  { usePersonaSessionOptional: () => personaValue }
);

afterAll(restorePersona);

import { ComposerPersonaChip } from "@/components/personas/persona-chip";
import {
  PromptInput,
  PromptInputTextarea,
} from "@/components/third-party/ai-elements/prompt-input";
import { render } from "../helpers/render";

afterEach(() => {
  cleanup();
  personaValue = null;
});

describe("PromptInputTextarea", () => {
  test("server-renders one row, matching minRows, so the composer doesn't shrink on hydration", () => {
    const html = renderToString(
      <PromptInput onSubmit={() => {}}>
        <PromptInputTextarea />
      </PromptInput>
    );
    const host = document.createElement("div");

    host.innerHTML = html;
    expect(host.querySelector("textarea")?.getAttribute("rows")).toBe("1");
  });
});

describe("ComposerPersonaChip", () => {
  test("renders nothing on a surface without the persona provider", () => {
    const { container } = render(<ComposerPersonaChip />);

    expect(container.innerHTML).toBe("");
  });

  test("holds its space with an invisible, inert button while the session loads", () => {
    personaValue = { ready: false, session: null } as never;
    const { container } = render(<ComposerPersonaChip />);
    const button = container.querySelector("button");

    expect(button).toBeTruthy();
    expect(button?.className).toContain("invisible");
    expect(button?.hasAttribute("disabled")).toBe(true);
    expect(button?.getAttribute("aria-hidden")).toBe("true");
    expect(button?.getAttribute("tabindex")).toBe("-1");
  });
});
