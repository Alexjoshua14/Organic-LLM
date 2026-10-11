import { expect, test } from "bun:test";
import { SQL, type TransactionSQL } from "bun";

// Opt-in, like admin-access-migration.test.ts. All DDL and fixtures are rolled back.
const databaseUrl = process.env.USAGE_LEDGER_TEST_DATABASE_URL;
const databaseTest = databaseUrl ? test : test.skip;
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMBER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NEW = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EVENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ADJUSTMENT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

async function denied(tx: TransactionSQL, query: string, errno = "42501") {
  let failure: unknown;
  try {
    await tx.savepoint(async (sp) => {
      await sp.unsafe(query);
    });
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ errno });
}

databaseTest(
  "entitlements and append-only accounting enforce ownership, resets, and corrections in Postgres",
  async () => {
    const db = new SQL(databaseUrl!);
    const schema = `usage_ledger_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const rolledBack = new Error("Roll back ledger verification");
    const migration = await Bun.file(
      new URL("../../docs/migrations/account_entitlements.sql", import.meta.url)
    ).text();
    try {
      await db.begin(async (tx) => {
        await tx
          .unsafe(
            `
        CREATE SCHEMA ${schema};
        GRANT USAGE ON SCHEMA ${schema} TO anon, authenticated, service_role;
        CREATE TABLE ${schema}.profiles (id UUID PRIMARY KEY, clerk_user_id TEXT NOT NULL UNIQUE);
        CREATE TABLE ${schema}.admin_access (profile_id UUID PRIMARY KEY REFERENCES ${schema}.profiles(id));
        CREATE FUNCTION ${schema}.current_profile_id() RETURNS UUID LANGUAGE sql STABLE
          AS $$ SELECT nullif(current_setting('test.profile_id', true), '')::uuid $$;
        INSERT INTO ${schema}.profiles VALUES ('${ADMIN}', 'test_admin'), ('${MEMBER}', 'test_member');
        INSERT INTO ${schema}.admin_access VALUES ('${ADMIN}');
      `
          )
          .simple();
        const baseMigration = await Bun.file(
          new URL("../../docs/migrations/llm_usage_events.sql", import.meta.url)
        ).text();
        await tx
          .unsafe(
            baseMigration.replace(
              /\b(llm_usage_events|profiles|current_profile_id)\b/g,
              (name) => `${schema}.${name}`
            )
          )
          .simple();
        const sql = migration
          .replace(/^BEGIN;$/gm, "")
          .replace(/^COMMIT;$/gm, "")
          .replaceAll("public.", `${schema}.`);
        await tx.unsafe(sql).simple();
        // A second deployment must preserve balances and corrections, not reset them.
        await tx.unsafe(sql).simple();
        await tx.unsafe(`INSERT INTO ${schema}.profiles VALUES ('${NEW}', 'test_new')`);
        expect(
          await tx.unsafe(
            `SELECT plan, resets_remaining FROM ${schema}.account_entitlements WHERE profile_id='${NEW}'`
          )
        ).toEqual([{ plan: "free", resets_remaining: 5 }]);

        await tx.unsafe("SET LOCAL ROLE service_role");
        await tx.unsafe(
          `INSERT INTO ${schema}.llm_usage_events(id,owner_id,cost_usd,model_id) VALUES ('${EVENT}', '${MEMBER}', 10, 'test-model')`
        );
        await denied(tx, `UPDATE ${schema}.llm_usage_events SET cost_usd=0`);
        await denied(tx, `DELETE FROM ${schema}.llm_usage_events`);
        await denied(tx, `TRUNCATE ${schema}.llm_usage_events`);
        const append = `SELECT * FROM ${schema}.append_llm_usage_adjustment('${ADJUSTMENT}', '${MEMBER}', '${EVENT}', -2, 'Duplicate charge correction', '${ADMIN}')`;
        expect(await tx.unsafe(append)).toHaveLength(1);
        expect(await tx.unsafe(append)).toHaveLength(1);
        expect(
          await tx.unsafe(
            `SELECT * FROM ${schema}.append_llm_usage_adjustment('${ADJUSTMENT}', '${MEMBER}', '${EVENT}', -3, 'Different correction', '${ADMIN}')`
          )
        ).toHaveLength(0);
        expect(
          await tx.unsafe(
            `SELECT ${schema}.sum_llm_usage_cost('${MEMBER}', now()-interval '1 day', now()+interval '1 day') AS cost`
          )
        ).toEqual([{ cost: "8.000000" }]);
        await denied(
          tx,
          `SELECT * FROM ${schema}.append_llm_usage_adjustment(gen_random_uuid(), '${ADMIN}', '${EVENT}', -2, 'Wrong owner', '${ADMIN}')`
        );
        await denied(
          tx,
          `SELECT * FROM ${schema}.append_llm_usage_adjustment(gen_random_uuid(), '${MEMBER}', '${EVENT}', -2, 'Not admin', '${MEMBER}')`
        );
        await denied(tx, `UPDATE ${schema}.llm_usage_adjustments SET delta_usd=0`);
        await denied(tx, `DELETE FROM ${schema}.llm_usage_adjustments`);
        await denied(tx, `TRUNCATE ${schema}.llm_usage_adjustments`);

        const [entitlement] = await tx.unsafe(
          `SELECT cycle_anchor::text AS anchor FROM ${schema}.account_entitlements WHERE profile_id='${MEMBER}'`
        );
        const reset = `SELECT * FROM ${schema}.consume_usage_reset('${MEMBER}', '${entitlement.anchor}')`;
        expect(await tx.unsafe(reset)).toHaveLength(1);
        expect(await tx.unsafe(reset)).toHaveLength(0);
        expect(
          await tx.unsafe(
            `SELECT resets_remaining FROM ${schema}.account_entitlements WHERE profile_id='${MEMBER}'`
          )
        ).toEqual([{ resets_remaining: 4 }]);
        await tx.unsafe(
          `UPDATE ${schema}.account_entitlements SET resets_remaining=0 WHERE profile_id='${MEMBER}'`
        );
        expect(
          await tx.unsafe(
            `SELECT * FROM ${schema}.consume_usage_reset('${MEMBER}', (SELECT cycle_anchor FROM ${schema}.account_entitlements WHERE profile_id='${MEMBER}'))`
          )
        ).toHaveLength(0);

        await tx.unsafe("SET LOCAL ROLE authenticated");
        await tx`SELECT set_config('test.profile_id', ${MEMBER}, true)`;
        expect(await tx.unsafe(`SELECT profile_id FROM ${schema}.account_entitlements`)).toEqual([
          { profile_id: MEMBER },
        ]);
        expect(await tx.unsafe(`SELECT id FROM ${schema}.llm_usage_adjustments`)).toEqual([
          { id: ADJUSTMENT },
        ]);
        await tx`SELECT set_config('test.profile_id', ${NEW}, true)`;
        expect(await tx.unsafe(`SELECT id FROM ${schema}.llm_usage_adjustments`)).toHaveLength(0);
        await denied(tx, `UPDATE ${schema}.account_entitlements SET plan='max'`);
        await denied(tx, reset);
        await denied(tx, append);
        await denied(
          tx,
          `INSERT INTO ${schema}.llm_usage_events(id,owner_id,cost_usd,model_id) VALUES (gen_random_uuid(), '${NEW}', 0, 'test-model')`
        );
        await denied(tx, `TRUNCATE ${schema}.llm_usage_events`);
        await tx.unsafe("RESET ROLE");
        // The trigger also rejects a privileged UPDATE: corrections must still be appended.
        await denied(tx, `UPDATE ${schema}.llm_usage_events SET cost_usd=0`);
        await denied(tx, `DELETE FROM ${schema}.llm_usage_adjustments`);
        await tx.unsafe(`DELETE FROM ${schema}.profiles WHERE id='${MEMBER}'`);
        expect(await tx.unsafe(`SELECT id FROM ${schema}.llm_usage_events`)).toEqual([
          { id: EVENT },
        ]);
        throw rolledBack;
      });
    } catch (error) {
      if (error !== rolledBack) throw error;
    } finally {
      await db.close();
    }
  },
  20_000
);
