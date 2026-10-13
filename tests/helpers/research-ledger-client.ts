import type { supabaseAdmin } from "@/lib/supabase/supabase-admin";

type Row = Record<string, unknown>;
export function researchLedgerClient() {
  const tables: Record<string, Row[]> = { threads: [], research_ledgers: [] };
  const queries: Array<{ table: string; operation: string; filters: Array<[string, unknown]> }> =
    [];
  const client = {
    from: (table: string) => {
      let operation = "select";
      let values: Row = {};
      const filters: Array<[string, unknown]> = [];
      const execute = () => {
        queries.push({ table, operation, filters: [...filters] });
        const rows = tables[table];
        if (!rows) return { data: null, error: { message: "Missing table" } };
        const matches = rows.filter((row) => filters.every(([key, value]) => row[key] === value));
        if (operation === "insert") {
          const row = { payload: null, payload_rev: null, legacy_thread_id: null, ...values };
          rows.push(row);
          return { data: [row], error: null };
        }
        if (operation === "update") for (const row of matches) Object.assign(row, values);
        if (operation === "delete") tables[table] = rows.filter((row) => !matches.includes(row));
        return { data: matches.map((row) => ({ ...row })), error: null };
      };
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return builder;
        },
        is: (key: string, value: unknown) => {
          filters.push([key, value]);
          return builder;
        },
        update: (value: Row) => {
          operation = "update";
          values = value;
          return builder;
        },
        insert: (value: Row) => {
          operation = "insert";
          values = value;
          return builder;
        },
        delete: () => {
          operation = "delete";
          return builder;
        },
        maybeSingle: async () => {
          const result = execute();
          return { ...result, data: result.data?.[0] ?? null };
        },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return builder;
    },
  } as unknown as Pick<typeof supabaseAdmin, "from">;
  return { client, tables, queries };
}
