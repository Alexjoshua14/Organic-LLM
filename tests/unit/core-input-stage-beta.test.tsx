import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useRef } from "react";

import { DEFAULT_COMPOSER_MODEL } from "@/lib/chat/composer-tool-defaults";
import { coreInputScopes } from "@/lib/core-input/scopes";
import type { ChatModel } from "@/lib/schemas/chat";

import { installBrowserMedia } from "../helpers/browser-media";

let restoreMedia: () => void;
let stored: [string, string][];
beforeEach(() => {
  restoreMedia = installBrowserMedia();
  stored = Object.entries(localStorage);
});

const clerk = { ...(await import("@clerk/nextjs")) };
const chat = { ...(await import("@/lib/context/chat-context")) };
mock.module("@clerk/nextjs", () => ({
  ...clerk,
  useUser: () => ({ user: null }),
  useAuth: () => ({ isLoaded: true, userId: null }),
}));
mock.module("@/lib/context/chat-context", () => ({
  ...chat,
  useSharedChatContext: () => ({ refreshSidebarChats: () => undefined }),
}));
const { CoreInput } = await import("@/components/chat/core-input");

afterEach(() => {
  cleanup();
  restoreMedia();
  localStorage.clear();
  for (const [key, value] of stored) localStorage.setItem(key, value);
});
afterAll(() => {
  mock.module("@clerk/nextjs", () => clerk);
  mock.module("@/lib/context/chat-context", () => chat);
});

const scope = coreInputScopes.area("stage-beta-test");
const send = mock(async (_message: unknown) => undefined);
function Composer({ variant = "stage-beta" }: { variant?: "default" | "stage-beta" }) {
  const model = useRef<ChatModel>(DEFAULT_COMPOSER_MODEL);
  const search = useRef(false);
  const memory = useRef(false);
  const speech = useRef(false);
  return (
    <CoreInput
      variant={variant}
      snapshotScope={scope}
      modelRef={model}
      useWebSearchRef={search}
      useMemoriesRef={memory}
      useSpeechFriendlyRef={speech}
      sendMessage={send}
      stop={async () => undefined}
      status="ready"
      featureHints={false}
      showContextBudget={false}
      defaultWebSearch={false}
      defaultMemories={false}
      voiceControl={<button type="button">Start voice session</button>}
    />
  );
}

test("beta sends a multiline draft through CoreInput while keeping voice and options available", async () => {
  send.mockClear();
  const app = render(<Composer />);
  const input = app.getByRole("textbox", { name: "Message Organic" });
  expect(input.getAttribute("aria-multiline")).toBe("true");
  expect(app.getByRole("button", { name: "Composer options" })).toBeTruthy();
  expect(app.getByRole("button", { name: "Start voice session" })).toBeTruthy();
  fireEvent.change(input, { target: { value: "First thought\nAnd a second line" } });
  fireEvent.click(app.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send.mock.calls[0]?.[0]).toMatchObject({ text: "First thought\nAnd a second line" });
});

test("mounting Stage beta does not reset global composer preferences", () => {
  localStorage.setItem("organic-llm-web-search", "true");
  localStorage.setItem("organic-llm-speech-friendly", "true");
  localStorage.setItem("organic-llm-prefs-timestamp", "expired");
  render(<Composer />);
  expect(localStorage.getItem("organic-llm-web-search")).toBe("true");
  expect(localStorage.getItem("organic-llm-speech-friendly")).toBe("true");
  expect(localStorage.getItem("organic-llm-prefs-timestamp")).toBe("expired");
});

test("default CoreInput keeps its existing layout and never adds beta controls", () => {
  const app = render(<Composer variant="default" />);
  expect(app.container.querySelector(".core-input-stage-beta")).toBeNull();
  expect(app.queryByRole("button", { name: "Composer options" })).toBeNull();
  expect(app.queryByRole("button", { name: "Start voice session" })).toBeNull();
});
