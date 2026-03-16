import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

// So that @/data/supabase/rabbitholes can load (it imports supabaseServer)
mock.module("@/lib/supabase/server", () => ({
  supabaseServer: async () =>
    ({ from: () => ({ update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }) }) as never,
}));

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const NODE_ID = "660e8400-e29b-41d4-a716-446655440001";

describe("advanceGenerationStep", () => {
  let advanceUpdatePayload: Record<string, unknown> | null = null;
  const advanceEqCalls: Array<[string, string]> = [];

  const createAdvanceMockClient = () => ({
    from: (table: string) => {
      if (table !== "rabbit_hole_sessions") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        update: (payload: Record<string, unknown>) => {
          advanceUpdatePayload = payload;
          return {
            eq: (col: string, val: string) => {
              advanceEqCalls.push([col, val]);
              return {
                eq: (col2: string, val2: string) => {
                  advanceEqCalls.push([col2, val2]);
                  return {
                    eq: (col3: string, val3: string) => {
                      advanceEqCalls.push([col3, val3]);
                      return {
                        select: () => ({
                          maybeSingle: () =>
                            Promise.resolve({
                              data: { session_id: SESSION_ID },
                              error: null,
                            }),
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  });

  beforeEach(() => {
    advanceUpdatePayload = null;
    advanceEqCalls.length = 0;
  });

  afterEach(() => {
    advanceUpdatePayload = null;
    advanceEqCalls.length = 0;
  });

  test("update with toStep sets generation_step and updated_at", async () => {
    const { advanceGenerationStep } = await import("@/data/supabase/rabbitholes");
    const client = createAdvanceMockClient() as any;

    const result = await advanceGenerationStep(
      SESSION_ID,
      NODE_ID,
      "sources",
      "article",
      client,
    );

    expect(result.updated).toBe(true);
    expect(advanceUpdatePayload).not.toBeNull();
    expect(advanceUpdatePayload!.generation_step).toBe("article");
    expect(advanceUpdatePayload!.updated_at != null).toBe(true);
    expect(advanceEqCalls[0]?.[0]).toBe("session_id");
    expect(advanceEqCalls[0]?.[1]).toBe(SESSION_ID);
    expect(advanceEqCalls[1]?.[0]).toBe("generating_node_id");
    expect(advanceEqCalls[1]?.[1]).toBe(NODE_ID);
    expect(advanceEqCalls[2]?.[0]).toBe("generation_step");
    expect(advanceEqCalls[2]?.[1]).toBe("sources");
  });

  test("update with toStep null clears generating_node_id and generation_step", async () => {
    const { advanceGenerationStep } = await import("@/data/supabase/rabbitholes");
    const client = createAdvanceMockClient() as any;

    const result = await advanceGenerationStep(
      SESSION_ID,
      NODE_ID,
      "branch_suggestions",
      null,
      client,
    );

    expect(result.updated).toBe(true);
    expect(advanceUpdatePayload).not.toBeNull();
    expect(advanceUpdatePayload!.generating_node_id).toBeNull();
    expect(advanceUpdatePayload!.generation_step).toBeNull();
    expect(advanceUpdatePayload!.updated_at != null).toBe(true);
    expect(advanceEqCalls[2]?.[0]).toBe("generation_step");
    expect(advanceEqCalls[2]?.[1]).toBe("branch_suggestions");
  });
});
