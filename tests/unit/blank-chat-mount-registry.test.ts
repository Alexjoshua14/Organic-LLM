import { describe, expect, test, beforeEach } from "bun:test";

import {
  isBlankChatMounted,
  releaseBlankChatMount,
  resetBlankChatMountRegistryForTests,
  retainBlankChatMount,
} from "@/lib/chat/blank-chat-mount-registry";

describe("blank-chat mount registry", () => {
  beforeEach(() => {
    resetBlankChatMountRegistryForTests();
  });

  test("remount in the same tick keeps the chat marked mounted", () => {
    const id = "11111111-1111-4111-8111-111111111111";

    retainBlankChatMount(id);
    releaseBlankChatMount(id);
    // Simulated layout remount before the deferred delete microtask runs.
    retainBlankChatMount(id);

    expect(isBlankChatMounted(id)).toBe(true);
  });

  test("true unmount leaves the chat unmounted", () => {
    const id = "22222222-2222-4222-8222-222222222222";

    retainBlankChatMount(id);
    releaseBlankChatMount(id);

    expect(isBlankChatMounted(id)).toBe(false);
  });

  test("nested mounts require matching releases", () => {
    const id = "33333333-3333-4333-8333-333333333333";

    retainBlankChatMount(id);
    retainBlankChatMount(id);
    releaseBlankChatMount(id);

    expect(isBlankChatMounted(id)).toBe(true);

    releaseBlankChatMount(id);

    expect(isBlankChatMounted(id)).toBe(false);
  });
});
