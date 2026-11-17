import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import type { ChatProps } from "@/components/chat/chat";
import { render } from "../helpers/render";

let props: ChatProps;
mock.module("@/components/chat/chat", () => ({
  Chat: (incoming: ChatProps) => {
    props = incoming;
    return <div>Shared chat</div>;
  },
}));
const { AionChat } = await import("@/components/chat/aionChat");
const { ArchetypeProvider, useArchetypeContext } = await import("@/lib/context/archetype-context");

function Probe() {
  const { showArchetype, archetypeData } = useArchetypeContext();
  return (
    <>
      <output>
        {showArchetype ? "Surface open" : "Surface closed"}:{archetypeData?.kind}
      </output>
      <button
        onClick={() =>
          props.clientTools!.show_memories({
            memories: [{ id: "m1", memory: "Prefers concise answers" }],
          })
        }
      >
        Show memories
      </button>
      <button onClick={() => props.clientTools!.set_state_archetype({ open: false })}>Close</button>
    </>
  );
}
afterEach(cleanup);

describe("Aion sandbox adapter", () => {
  test("uses shared Chat with Aion identity", () => {
    render(
      <ArchetypeProvider>
        <AionChat chatData={null} />
        <Probe />
      </ArchetypeProvider>
    );
    expect(props!.experience).toBe("aion");
    expect(props!.persona).toBe("aion");
    expect(props!.chatData).toBeNull();
  });
  test("client tool results update and inspect the actual surface", () => {
    const view = render(
      <ArchetypeProvider>
        <AionChat chatData={null} />
        <Probe />
      </ArchetypeProvider>
    );
    fireEvent.click(view.getByText("Show memories"));
    expect(view.getByText("Surface open:memory")).toBeTruthy();
    expect(props!.clientTools!.view_archetype({})).toMatchObject({
      state: true,
      archetype: { kind: "memory", memories: [{ id: "m1" }] },
    });
    fireEvent.click(view.getByText("Close"));
    expect(view.getByText("Surface closed:memory")).toBeTruthy();
  });
  test("rejects malformed surface commands instead of mutating the UI", () => {
    render(
      <ArchetypeProvider>
        <AionChat chatData={null} />
      </ArchetypeProvider>
    );
    expect(() => props!.clientTools!.set_state_archetype({ open: "yes" })).toThrow();
    expect(() =>
      props!.clientTools!.show_memories({ memories: [{ memory: "missing id" }] })
    ).toThrow();
  });
});
