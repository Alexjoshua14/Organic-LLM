/** In-memory Redis boundary; the tests keep the real resumable-stream protocol. */
export function createResumableRedisFixture() {
  const values = new Map<string, string>();
  const channels = new Map<string, Map<object, (message: string) => void>>();
  const clients: ReturnType<typeof createClient>[] = [];
  let connectionError: Error | null = null;

  function createClient() {
    const subscriptions = new Set<string>();
    const client = {
      isOpen: false,
      disconnects: 0,
      on: () => client,
      async connect() {
        if (connectionError) throw connectionError;
        client.isOpen = true;
      },
      async disconnect() {
        client.disconnects++;
        client.isOpen = false;
        for (const channel of subscriptions) channels.get(channel)?.delete(client);
        subscriptions.clear();
      },
      async subscribe(channel: string, listener: (message: string) => void) {
        assertConnected();
        const listeners = channels.get(channel) ?? new Map();
        channels.set(channel, listeners);
        listeners.set(client, listener);
        subscriptions.add(channel);
      },
      async unsubscribe(channel: string) {
        channels.get(channel)?.delete(client);
        subscriptions.delete(channel);
      },
      async publish(channel: string, message: string) {
        assertConnected();
        const listeners = [...(channels.get(channel)?.values() ?? [])];
        for (const listener of listeners) queueMicrotask(() => listener(message));
        return listeners.length;
      },
      async get(key: string) {
        assertConnected();
        return values.get(key) ?? null;
      },
      async set(key: string, value: string) {
        assertConnected();
        values.set(key, value);
        return "OK";
      },
      async incr(key: string) {
        assertConnected();
        const value = values.get(key) ?? "0";
        if (value === "DONE") throw new Error("ERR value is not an integer or out of range");
        const next = Number(value) + 1;
        values.set(key, String(next));
        return next;
      },
    };
    function assertConnected() {
      if (!client.isOpen) throw new Error("Redis command issued before connect()");
    }
    clients.push(client);
    return client;
  }

  return {
    createClient,
    clients,
    values,
    failConnections: (error: Error | null) => {
      connectionError = error;
    },
  };
}
