import { expect, test } from "bun:test";
import { SQL } from "bun";

// Opt in against a disposable PostgreSQL database with anon/authenticated/service_role roles.
// A generated schema and all fixture changes are rolled back, including grants/functions.
const databaseUrl = process.env.HEARTBEAT_TEST_DATABASE_URL;
const databaseTest = databaseUrl ? test : test.skip;
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

databaseTest(
  "heartbeat reporting aggregates privately and preserves new metrics during compaction",
  async () => {
    const db = new SQL(databaseUrl!);
    const schema = `heartbeat_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const rollback = new Error("Roll back heartbeat fixtures");
    try {
      await db.begin(async (tx) => {
        await tx
          .unsafe(
            `
        CREATE SCHEMA ${schema};
        GRANT USAGE ON SCHEMA ${schema} TO anon, authenticated, service_role;
        CREATE TABLE ${schema}.profiles (id UUID PRIMARY KEY);
        CREATE TABLE ${schema}.threads (id UUID PRIMARY KEY);
        INSERT INTO ${schema}.profiles VALUES ('${OWNER}');
        INSERT INTO ${schema}.threads VALUES ('${THREAD}');
      `
          )
          .simple();
        for (const file of [
          "heartbeat_runs.sql",
          "heartbeat_runs_hourly.sql",
          "heartbeat_admin_telemetry.sql",
        ]) {
          const migration = await Bun.file(
            new URL(`../../docs/migrations/${file}`, import.meta.url)
          ).text();
          await tx
            .unsafe(
              migration
                .replace(/^BEGIN;$/gm, "")
                .replace(/^COMMIT;$/gm, "")
                .replaceAll("public.", `${schema}.`)
            )
            .simple();
        }
        await tx.unsafe(`SET LOCAL ROLE service_role`);
        await tx
          .unsafe(
            `
        INSERT INTO ${schema}.heartbeat_runs (
          id, owner_id, thread_id, started_at, duration_ms, status, stage,
          subagent_count, working_subagent_count, snapshot_chars, snapshot_duration_ms,
          evaluation_attempted, evaluation_duration_ms, event_count, model_id,
          input_tokens, output_tokens, cost_usd
        ) VALUES
          ('00000000-0000-4000-8000-000000000001', '${OWNER}', '${THREAD}', CURRENT_TIMESTAMP - INTERVAL '1 minute', 100, 'notable', 'finished', 3, 2, 1000, 30, true, 60, 1, 'typesafe-ai/jev', 1000, 0, 0.00004),
          ('00000000-0000-4000-8000-000000000002', '${OWNER}', '${THREAD}', CURRENT_TIMESTAMP - INTERVAL '2 minutes', 300, 'quiet', 'finished', 3, 1, 2000, 50, true, 160, 0, 'typesafe-ai/jev', 3000, 0, NULL),
          ('00000000-0000-4000-8000-000000000003', '${OWNER}', '${THREAD}', CURRENT_TIMESTAMP - INTERVAL '3 minutes', 50, 'unchanged', 'finished', 3, NULL, NULL, NULL, false, NULL, 0, NULL, NULL, NULL, NULL),
          ('00000000-0000-4000-8000-000000000004', '${OWNER}', '${THREAD}', CURRENT_TIMESTAMP - INTERVAL '11 days', 100, 'notable', 'finished', 3, 2, 1000, 30, true, 60, 1, 'typesafe-ai/jev', 1000, 0, 0.00004);
      `
          )
          .simple();
        const read = async (status = "all", offset = 0) => {
          const [row] = await tx.unsafe(
            `SELECT ${schema}.read_admin_heartbeat_telemetry(24, '${status}', ${offset}) AS data`
          );
          return row.data;
        };
        const result = await read();
        expect(result.summary).toMatchObject({
          runs: 3,
          evaluations: 2,
          notable: 1,
          token_samples: 2,
          input_tokens: 4000,
          input_p50: 2000,
          duration_p50: 100,
          working_avg: 1.5,
          working_max: 2,
          working_samples: 2,
          snapshot_chars_avg: 1500,
          snapshot_duration_avg: 40,
          reported_cost: 0.00004,
          cost_samples: 1,
          jev_estimated_cost: 0.00016,
        });
        expect(result.runs).toHaveLength(3);
        expect(result.runs[0].status).toBe("notable");
        expect(JSON.stringify(result)).not.toContain(OWNER);
        expect(JSON.stringify(result)).not.toContain(THREAD);
        expect((await read("notable")).summary.runs).toBe(1);
        expect((await read("all", 50)).runs).toHaveLength(0);
        await tx.unsafe(`SELECT ${schema}.cleanup_heartbeat_runs(100)`);
        const [aggregate] = await tx.unsafe(`SELECT * FROM ${schema}.heartbeat_runs_hourly`);
        expect(aggregate).toMatchObject({ working_subagent_max: 2 });
        expect(Number(aggregate.working_subagent_samples)).toBe(1);
        expect(Number(aggregate.working_subagent_sum)).toBe(2);
        expect(Number(aggregate.snapshot_chars_sum)).toBe(1000);
        expect(Number(aggregate.snapshot_duration_ms_sum)).toBe(30);
        await tx.unsafe(`SELECT ${schema}.cleanup_heartbeat_runs(100)`);
        const [count] = await tx.unsafe(
          `SELECT sum(run_count) AS n FROM ${schema}.heartbeat_runs_hourly`
        );
        expect(Number(count.n)).toBe(1);

        for (const role of ["anon", "authenticated"]) {
          await tx.unsafe(`SET LOCAL ROLE ${role}`);
          for (const query of [
            `SELECT * FROM ${schema}.heartbeat_runs`,
            `SELECT * FROM ${schema}.heartbeat_runs_hourly`,
            `SELECT ${schema}.read_admin_heartbeat_telemetry()`,
          ]) {
            let failure: unknown;
            try {
              await tx.savepoint(async (savepoint) => {
                await savepoint.unsafe(query);
              });
            } catch (error) {
              failure = error;
            }
            expect(failure).toMatchObject({ errno: "42501" });
          }
        }
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.close();
    }
  },
  20_000
);
