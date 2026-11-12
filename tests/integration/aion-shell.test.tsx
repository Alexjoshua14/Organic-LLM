import { afterEach, expect, mock, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import type { Thread } from "@/lib/schemas/chat";
import { render } from "../helpers/render";

let layoutMode = "chat";
mock.module("@/app/sandbox/arcadia/_components/multitask-provider", () => ({
  useArcadiaMultitask: () => ({ layoutMode }),
}));
mock.module("@/components/chat/aionChat", () => ({
  AionChat: () => <input aria-label="Aion draft" defaultValue="Continue this thought" />,
}));
mock.module("@/components/ambient/AdaptiveOrganicPresence", () => ({
  AdaptiveOrganicPresence: () => null,
}));
mock.module("@/app/sandbox/aion/_components/archetype-host", () => ({
  ArchetypeHost: () => <div>Memory surface</div>,
}));
const { AionShell } = await import("@/app/sandbox/aion/_components/aion-shell");
const { AionPresenceProvider } = await import(
  "@/app/sandbox/aion/_components/aion-presence-provider"
);
const { ArchetypeProvider } = await import("@/lib/context/archetype-context");
afterEach(cleanup);

test("surface and multiagent changes preserve exactly one conversation and its draft", () => {
  const chatData = {
    thread: { id: "11111111-1111-4111-8111-111111111111" } as Thread,
    messages: [],
  };
  const tree = () => (
    <ArchetypeProvider>
      <AionPresenceProvider>
        <AionShell chatData={chatData} />
      </AionPresenceProvider>
    </ArchetypeProvider>
  );
  const view = render(tree());
  const draft = view.getByLabelText("Aion draft") as HTMLInputElement;
  fireEvent.change(draft, { target: { value: "Keep my draft" } });
  fireEvent.click(view.getByRole("button", { name: "Surface" }));
  expect(view.getByText("Memory surface")).toBeTruthy();
  expect(view.getAllByLabelText("Aion draft")).toHaveLength(1);
  expect(view.getByLabelText("Aion draft")).toBe(draft);
  fireEvent.click(view.getByRole("button", { name: "Close surface" }));
  layoutMode = "dashboard";
  view.rerender(tree());
  expect(view.getAllByLabelText("Aion draft")).toHaveLength(1);
  expect(view.getByLabelText("Aion draft")).toBe(draft);
  expect(draft.value).toBe("Keep my draft");
});
