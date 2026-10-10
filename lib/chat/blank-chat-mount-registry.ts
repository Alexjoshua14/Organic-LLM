/**
 * Ref-count CoreInput mounts per chat id so blank-chat auto-delete can tell a real
 * navigation away from a same-tick remount (e.g. Arcadia multitask layout switch).
 */

const mountCounts = new Map<string, number>();

export function retainBlankChatMount(chatId: string): void {
  mountCounts.set(chatId, (mountCounts.get(chatId) ?? 0) + 1);
}

export function releaseBlankChatMount(chatId: string): void {
  const next = (mountCounts.get(chatId) ?? 1) - 1;

  if (next <= 0) {
    mountCounts.delete(chatId);
  } else {
    mountCounts.set(chatId, next);
  }
}

export function isBlankChatMounted(chatId: string): boolean {
  return (mountCounts.get(chatId) ?? 0) > 0;
}

/** Test-only: clear registry between cases. */
export function resetBlankChatMountRegistryForTests(): void {
  mountCounts.clear();
}
