import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
mock.module("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "clerk-user-1" }),
}));
mock.module("@/data/supabase/profiles", () => ({
  getSupabaseUserId: async () => ({
    data: "owner-1",
    error: null,
  }),
}));

type MessageRow = {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  created_at: string;
  schema_kind: "ui_message";
  schema_version: number;
  text_excerpt?: string;
};

type ThreadRow = {
  id: string;
  owner_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  conversation_summary: string | null;
};

type ThreadSummaryRow = {
  thread_id: string;
  summary_text: string;
};

type TableName = "messages" | "threads" | "thread_summaries";

class QueryBuilder<T extends Record<string, unknown>> {
  private filters: Array<{ column: string; value: unknown }> = [];
  private orderBy?: { column: string; ascending: boolean };
  private expectSingle = false;
  private pendingUpdate?: Partial<T>;

  constructor(private rows: T[]) {}

  select() {
    return this;
  }

  insert(values: T | T[]) {
    const items = Array.isArray(values) ? values : [values];
    this.rows.push(...items);
    return Promise.resolve({ error: null });
  }

  update(values: Partial<T>) {
    this.pendingUpdate = values;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  single() {
    this.expectSingle = true;
    return this;
  }

  then<TResult1 = { data: T[] | T | null; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((
          value: { data: T[] | T | null; error: { message: string } | null },
        ) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute() {
    let result = [...this.rows];

    for (const filter of this.filters) {
      result = result.filter((row) => row[filter.column] === filter.value);
    }

    if (this.pendingUpdate) {
      result.forEach((row) => Object.assign(row, this.pendingUpdate));
      return Promise.resolve({
        data: null,
        error: null,
      });
    }

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      result.sort((left, right) => {
        const leftValue = left[column];
        const rightValue = right[column];

        if (typeof leftValue === "string" && typeof rightValue === "string") {
          return ascending
            ? leftValue.localeCompare(rightValue)
            : rightValue.localeCompare(leftValue);
        }

        return 0;
      });
    }

    if (this.expectSingle) {
      return Promise.resolve({
        data: result[0] ?? null,
        error: result.length === 1 ? null : { message: "Expected one row" },
      });
    }

    return Promise.resolve({
      data: result,
      error: null,
    });
  }
}

class MockSupabaseClient {
  messages: MessageRow[] = [];
  threads: ThreadRow[] = [];
  threadSummaries: ThreadSummaryRow[] = [];

  from(table: TableName) {
    switch (table) {
      case "messages":
        return new QueryBuilder(this.messages);
      case "threads":
        return new QueryBuilder(this.threads);
      case "thread_summaries":
        return new QueryBuilder(this.threadSummaries);
    }
  }
}

const mockSupabaseServer = mock(async () => new MockSupabaseClient());

mock.module("@/lib/supabase/server", () => ({
  supabaseServer: mockSupabaseServer,
}));

describe("chat data encryption", () => {
  let chatModule: typeof import("@/data/supabase/chat");
  let client: MockSupabaseClient;

  beforeEach(async () => {
    process.env.ORGANIC_LLM_ROOT_SECRET = "test-root-secret";
    process.env.ORGANIC_LLM_ACTIVE_KEY_ID = "k1";

    client = new MockSupabaseClient();
    client.threads.push({
      id: "11111111-1111-4111-8111-111111111111",
      owner_id: "owner-1",
      title: null,
      created_at: "2026-03-10T00:00:00.000Z",
      updated_at: "2026-03-10T00:00:00.000Z",
      conversation_summary: null,
    });
    mockSupabaseServer.mockImplementation(async () => client);
    chatModule = await import("@/data/supabase/chat");
  });

  test("addMessage encrypts stored content and getMessages decrypts it", async () => {
    const message = {
      id: "22222222-2222-4222-8222-222222222222",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "Hello encrypted world" }],
    };

    const addResult = await chatModule.addMessage(
      "11111111-1111-4111-8111-111111111111",
      message,
    );

    expect(addResult.ok).toBe(true);
    expect(client.messages).toHaveLength(1);
    expect(client.messages[0].content.startsWith("enc:v1:k1:")).toBe(true);

    const getResult = await chatModule.getMessages(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(getResult.error).toBeNull();
    expect(getResult.data).not.toBeNull();
    expect(getResult.data!).toHaveLength(1);
    expect(getResult.data![0].id).toBe("22222222-2222-4222-8222-222222222222");
    expect(getResult.data![0].role).toBe("user");
    expect(getResult.data![0].parts).toHaveLength(1);
    expect(getResult.data![0].parts[0].type).toBe("text");
    expect((getResult.data![0].parts[0] as { text: string }).text).toBe(
      "Hello encrypted world",
    );
  });

  test("getMessages supports legacy plaintext rows", async () => {
    client.messages.push({
      id: "33333333-3333-4333-8333-333333333333",
      thread_id: "11111111-1111-4111-8111-111111111111",
      role: "assistant",
      content: JSON.stringify({
        id: "33333333-3333-4333-8333-333333333333",
        role: "assistant",
        parts: [{ type: "text", text: "Legacy plaintext content" }],
      }),
      text_excerpt: "Legacy plaintext content",
      created_at: "2026-03-10T00:00:01.000Z",
      schema_kind: "ui_message",
      schema_version: 1,
    });

    const result = await chatModule.getMessages(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data!).toHaveLength(1);
    expect(result.data![0].role).toBe("assistant");
    expect(result.data![0].parts).toHaveLength(1);
    expect(result.data![0].parts[0].type).toBe("text");
    expect((result.data![0].parts[0] as { text: string }).text).toBe(
      "Legacy plaintext content",
    );
    expect(client.messages[0].text_excerpt).toBe("Legacy plaintext content");
  });

  test("getConversationSummary decrypts encrypted summary text", async () => {
    const cryptoModule = await import("@/lib/crypto/message-encryption");
    client.threadSummaries.push({
      thread_id: "11111111-1111-4111-8111-111111111111",
      summary_text: cryptoModule.encryptForStorage("Encrypted summary", {
        userId: "owner-1",
        threadId: "11111111-1111-4111-8111-111111111111",
        fieldName: "thread_summaries.summary_text",
      }),
    });

    const result = await chatModule.getConversationSummary(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result.error).toBeNull();
    expect(result.data).toBe("Encrypted summary");
  });

  test("updateConversationSummary stores encrypted thread summaries", async () => {
    const result = await chatModule.updateConversationSummary(
      "11111111-1111-4111-8111-111111111111",
      "Fresh conversation summary",
    );

    expect(result.ok).toBe(true);
    expect(
      client.threads[0].conversation_summary?.startsWith("enc:v1:k1:"),
    ).toBe(true);
  });
});
