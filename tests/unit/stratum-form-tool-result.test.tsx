import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";

import { ChatSendProvider } from "@/components/chat/chat-send-context";
import { StratumFormToolResult } from "@/components/chat/stratum/StratumFormToolResult";
import type { StratumForm } from "@/lib/schemas/stratum";
import { render } from "../helpers/render";

const FORM: StratumForm = {
  type: "stratum-form",
  version: 1,
  stage: "users",
  title: "Who is this for?",
  fields: [
    { kind: "text", id: "who", label: "Primary user" },
    {
      kind: "single_select",
      id: "reach",
      label: "How do they find it?",
      options: [
        { id: "appstore", label: "App Store" },
        { id: "word", label: "Word of mouth" },
      ],
      optional: true,
    },
    {
      kind: "scale",
      id: "urgency",
      label: "How urgent is their problem?",
      minLabel: "mild",
      maxLabel: "burning",
      optional: true,
    },
  ],
};

const OUTPUT = { kind: "stratum-form", form: FORM };

afterEach(() => {
  cleanup();
});

function renderForm(interactive: boolean, sendText = mock((_text: string) => {})) {
  const utils = render(
    <ChatSendProvider sendText={sendText}>
      <StratumFormToolResult interactive={interactive} output={OUTPUT} />
    </ChatSendProvider>
  );

  return { ...utils, sendText };
}

describe("StratumFormToolResult", () => {
  test("renders title, fields, and the beta marker", () => {
    const { getByText } = renderForm(true);

    expect(getByText("Who is this for?")).toBeTruthy();
    expect(getByText("Primary user")).toBeTruthy();
    expect(getByText("App Store")).toBeTruthy();
    expect(getByText("beta")).toBeTruthy();
  });

  test("submit stays disabled until required fields are answered", () => {
    const { getByText, container } = renderForm(true);
    const submit = getByText("Send answers").closest("button")!;

    expect(submit.disabled).toBe(true);

    const input = container.querySelector("input[type=text]")!;

    fireEvent.change(input, { target: { value: "Indie iOS devs" } });
    expect(submit.disabled).toBe(false);
  });

  test("submitting sends formatted answers and collapses the form", () => {
    const { getByText, container, sendText } = renderForm(true);

    fireEvent.change(container.querySelector("input[type=text]")!, {
      target: { value: "Indie iOS devs" },
    });
    fireEvent.click(getByText("App Store"));
    fireEvent.click(getByText("4"));
    fireEvent.click(getByText("Send answers"));

    expect(sendText).toHaveBeenCalledTimes(1);
    const message = sendText.mock.calls[0][0];

    expect(message).toContain("Discovery answers — Who is this for? (users)");
    expect(message).toContain("- Primary user: Indie iOS devs");
    expect(message).toContain("- How do they find it?: App Store");
    expect(message).toContain("- How urgent is their problem?: 4/5");

    expect(getByText("answers sent")).toBeTruthy();
  });

  test("non-interactive render collapses to an answered chip", () => {
    const { getByText, queryByText } = renderForm(false);

    expect(getByText("answered in chat")).toBeTruthy();
    expect(queryByText("Send answers")).toBeNull();
  });

  test("invalid output renders nothing", () => {
    const { container } = render(
      <ChatSendProvider sendText={mock(() => {})}>
        <StratumFormToolResult interactive output={{ kind: "stratum-form", form: null }} />
      </ChatSendProvider>
    );

    expect(container.innerHTML).toBe("");
  });
});
