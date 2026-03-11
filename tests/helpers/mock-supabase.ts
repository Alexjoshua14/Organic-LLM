// In-memory Supabase test double with a thenable query builder.
// Supports the subset of chaining used by the app's current route/data tests:
// - from("messages" | "threads")
// - select(...)
// - eq(...)
// - order(...)
// - limit(...)
// - single()

export type MessageRow = {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  created_at: string;
  schema_kind?: string;
  schema_version?: number;
};

export type ThreadRow = {
  id: string;
  owner_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  pinned?: boolean;
};

type TableRow = MessageRow | ThreadRow;

type QueryResult<T> = {
  data: T[] | T | null;
  error: { message: string } | null;
  count?: number | null;
};

type SelectOptions = {
  count?: "exact";
  head?: boolean;
};

class QueryBuilder<T extends TableRow> {
  private rows: T[];
  private filters: Record<string, unknown> = {};
  private orderBy?: { column: string; ascending: boolean };
  private limitValue?: number;
  private selectOptions?: SelectOptions;
  private expectSingle = false;

  constructor(rows: T[]) {
    this.rows = rows;
  }

  select(_columns?: string, options?: SelectOptions) {
    this.selectOptions = options;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  single() {
    this.expectSingle = true;
    return this;
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute(): Promise<QueryResult<T>> {
    try {
      let result = [...this.rows];

      for (const [column, value] of Object.entries(this.filters)) {
        result = result.filter((row) => row[column as keyof T] === value);
      }

      if (this.orderBy) {
        const { column, ascending } = this.orderBy;
        result.sort((a, b) => {
          const left = a[column as keyof T];
          const right = b[column as keyof T];
          const leftTime =
            typeof left === "string" ? new Date(left).getTime() : Number(left);
          const rightTime =
            typeof right === "string"
              ? new Date(right).getTime()
              : Number(right);
          return ascending ? leftTime - rightTime : rightTime - leftTime;
        });
      }

      if (this.limitValue != null) {
        result = result.slice(0, this.limitValue);
      }

      if (this.selectOptions?.head && this.selectOptions.count === "exact") {
        return Promise.resolve({
          data: null,
          error: null,
          count: result.length,
        });
      }

      if (this.expectSingle) {
        if (result.length !== 1) {
          return Promise.resolve({
            data: null,
            error: { message: "Expected exactly one row" },
          });
        }
        return Promise.resolve({
          data: result[0] ?? null,
          error: null,
        });
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
  private threads: ThreadRow[] = [];

  insertMessages(rows: MessageRow[]) {
    this.messages.push(...rows);
  }

  insertThreads(rows: ThreadRow[]) {
    this.threads.push(...rows);
  }

  from(table: string) {
    if (table === "messages") {
      return new QueryBuilder(this.messages);
    }
    if (table === "threads") {
      return new QueryBuilder(this.threads);
    }
    throw new Error(`Unsupported table: ${table}`);
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

export function createTestThreads(
  ownerId: string,
  count: number,
  options?: {
    titlePrefix?: string;
    pinnedEvery?: number;
    startTimeMs?: number;
  },
): ThreadRow[] {
  const base = options?.startTimeMs ?? Date.now();
  const titlePrefix = options?.titlePrefix ?? "Thread";
  const pinnedEvery = options?.pinnedEvery ?? 0;

  return Array.from({ length: count }).map((_, i) => {
    const idx = i + 1;
    return {
      id: `${ownerId}-thread-${idx}`,
      owner_id: ownerId,
      title: `${titlePrefix} ${idx}`,
      created_at: new Date(base + idx * 1000).toISOString(),
      updated_at: new Date(base + idx * 2000).toISOString(),
      pinned: pinnedEvery > 0 ? idx % pinnedEvery === 0 : false,
    };
  });
}

