import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const NODE_ID = "660e8400-e29b-41d4-a716-446655440001";

let updatePayload: Record<string, unknown> | null = null;
const eqCalls: Array<[string, string]> = [];

const createMockClient = () => ({
  from: (table: string) => {
    if (table !== "rabbit_hole_sessions") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        return {
          eq: (col: string, val: string) => {
            eqCalls.push([col, val]);
            return {
              eq: (col2: string, val2: string) => {
                eqCalls.push([col2, val2]);
                return {
                  eq: (col3: string, val3: string) => {
                    eqCalls.push([col3, val3]);
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

mock.module("server-only", () => ({}));

const { advanceGenerationStep } = await import(
  "@/data/supabase/rabbitholes"
);

beforeEach(() => {
  updatePayload = null;
  eqCalls.length = 0;
});

afterEach(() => {
  updatePayload = null;
  eqCalls.length = 0;
});

describe("advanceGenerationStep", () => {
  test("update with toStep sets generation_step and updated_at", async () => {
    const client = createMockClient() as any;

    const result = await advanceGenerationStep(
      SESSION_ID,
      NODE_ID,
      "sources",
      "article",
      client,
    );

    expect(result.updated).toBe(true);
    expect(updatePayload).not.toBeNull();
    expect(updatePayload!.generation_step).toBe("article");
    expect(updatePayload!.updated_at).toBeDefined();
    expect(eqCalls[0]).toEqual(["session_id", SESSION_ID]);
    expect(eqCalls[1]).toEqual(["generating_node_id", NODE_ID]);
    expect(eqCalls[2]).toEqual(["generation_step", "sources"]);
  });

  test("update with toStep null clears generating_node_id and generation_step", async () => {
    const client = createMockClient() as any;

    const result = await advanceGenerationStep(
      SESSION_ID,
      NODE_ID,
      "branch_suggestions",
      null,
      client,
    );

    expect(result.updated).toBe(true);
    expect(updatePayload).not.toBeNull();
    expect(updatePayload!.generating_node_id).toBeNull();
    expect(updatePayload!.generation_step).toBeNull();
    expect(updatePayload!.updated_at).toBeDefined();
    expect(eqCalls[2]).toEqual(["generation_step", "branch_suggestions"]);
  });
});
