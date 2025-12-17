// Mock Supabase client with in-memory storage and a Supabase-like query builder.
// Supports: from("messages").select().eq("thread_id", chatId).order(...).limit(...)
// Behavior: the last order() call wins (mirrors Supabase when chaining multiple order calls).

export type MessageRow = {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  created_at: string;
  schema_kind?: string;
  schema_version?: number;
};

type QueryResult = { data: MessageRow[] | null; error: { message: string } | null };

class MessagesQueryBuilder {
  private rows: MessageRow[];
  private filters: { thread_id?: string } = {};
  private orderBy?: { column: string; ascending: boolean };
  private limitValue?: number;
  private orderCallCount = 0;

  constructor(rows: MessageRow[]) {
    this.rows = rows;
  }

  select() {
    return this;
  }

  eq(column: string, value: string) {
    if (column === "thread_id") this.filters.thread_id = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCallCount += 1;
    this.orderBy = { column, ascending: options?.ascending ?? true };

    // getNMessages awaits the final call; in our chain the second order() returns the promise.
    if (this.orderCallCount >= 2) {
      return this.execute();
    }
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  private execute(): Promise<QueryResult> {
    try {
      let result = [...this.rows];

      // filter
      if (this.filters.thread_id) {
        result = result.filter((r) => r.thread_id === this.filters.thread_id);
      }

      // order (last order wins)
      if (this.orderBy?.column === "created_at") {
        const asc = this.orderBy.ascending;
        result.sort((a, b) =>
          asc
            ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      // limit
      if (this.limitValue != null) {
        result = result.slice(0, this.limitValue);
      }

      return Promise.resolve({ data: result, error: null });
    } catch (err) {
      return Promise.resolve({
        data: null,
        error: { message: err instanceof Error ? err.message : "Unknown error" },
      });
    }
  }
}

export class MockSupabaseClient {
  private messages: MessageRow[] = [];

  insertMessages(rows: MessageRow[]) {
    this.messages.push(...rows);
  }

  from(table: string) {
    if (table !== "messages") {
      throw new Error(`Unsupported table: ${table}`);
    }
    return new MessagesQueryBuilder(this.messages);
  }
}

export function createTestMessages(chatId: string, count: number): MessageRow[] {
  const base = Date.now();
  return Array.from({ length: count }).map((_, i) => {
    const idx = i + 1;
    const role = idx % 2 === 0 ? "assistant" : "user";
    const id = `${chatId}-msg-${idx}`;
    return {
      id,
      thread_id: chatId,
      role,
      content: JSON.stringify({
        id,
        role,
        parts: [{ type: "text", text: `Message ${idx}` }],
      }),
      created_at: new Date(base + idx * 1000).toISOString(),
      schema_kind: "ui_message",
      schema_version: 1,
    };
  });
}

