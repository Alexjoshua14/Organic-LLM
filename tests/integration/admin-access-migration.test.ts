import { expect, test } from "bun:test";
import { SQL, type TransactionSQL } from "bun";

// Explicit opt-in. Everything runs in an isolated schema inside a rolled-back transaction.
const databaseUrl = process.env.ADMIN_ACCESS_TEST_DATABASE_URL;
const databaseTest = databaseUrl ? test : test.skip;
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

async function expectDenied(tx: TransactionSQL, query: string, code = "42501") {
  let failure: unknown;

  try {
    await tx.savepoint(async (savepoint) => {
      await savepoint.unsafe(query);
    });
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ errno: code });
}

databaseTest(
  "admin-access migration enforces database permissions and account isolation",
  async () => {
    const db = new SQL(databaseUrl!);
    const schema = `admin_access_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const rolledBack = new Error("Verification complete; roll back fixture schema");
    const migration = await Bun.file(
      new URL("../../docs/migrations/admin_access.sql", import.meta.url)
    ).text();

    try {
      await db.begin(async (tx) => {
        await tx
          .unsafe(
            `
        CREATE SCHEMA ${schema};
        GRANT USAGE ON SCHEMA ${schema} TO anon, authenticated, service_role;
        CREATE TABLE ${schema}.profiles (
          id UUID PRIMARY KEY,
          clerk_user_id TEXT NOT NULL UNIQUE
        );
        ALTER TABLE ${schema}.profiles ENABLE ROW LEVEL SECURITY;
        GRANT SELECT ON ${schema}.profiles TO authenticated, service_role;
        GRANT INSERT, UPDATE, DELETE ON ${schema}.profiles TO service_role;
        CREATE POLICY profiles_select_self ON ${schema}.profiles
          FOR SELECT TO authenticated USING (clerk_user_id = public.clerk_sub());
        CREATE FUNCTION ${schema}.current_profile_id() RETURNS UUID
          LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
          AS $$ SELECT id FROM ${schema}.profiles WHERE clerk_user_id = public.clerk_sub() $$;
        INSERT INTO ${schema}.profiles (id, clerk_user_id) VALUES
          ('${ADMIN}', 'migration_admin'),
          ('${OTHER_ADMIN}', 'migration_other_admin'),
          ('${MEMBER}', 'migration_member');
      `
          )
          .simple();

        // Keep transaction control in this test; schema names are generated internally.
        await tx
          .unsafe(
            migration
              .replace(/^BEGIN;$/gm, "")
              .replace(/^COMMIT;$/gm, "")
              .replaceAll("public.", `${schema}.`)
          )
          .simple();
        expect(await tx.unsafe(`SELECT * FROM ${schema}.admin_access`)).toHaveLength(0);

        await tx.unsafe("SET LOCAL ROLE service_role");
        await tx.unsafe(
          `INSERT INTO ${schema}.admin_access (profile_id) VALUES ('${ADMIN}'), ('${OTHER_ADMIN}')`
        );
        const grants = await tx.unsafe(`SELECT * FROM ${schema}.admin_access`);
        expect(grants).toHaveLength(2);
        expect(grants.every((grant: { granted_at: unknown }) => grant.granted_at != null)).toBe(
          true
        );
        await expectDenied(
          tx,
          `INSERT INTO ${schema}.admin_access (profile_id) VALUES ('${ADMIN}')`,
          "23505"
        );
        await expectDenied(
          tx,
          `INSERT INTO ${schema}.admin_access (profile_id) VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd')`,
          "23503"
        );

        await tx.unsafe("SET LOCAL ROLE authenticated");
        await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: "migration_admin", role: "authenticated" })}, true)`;
        const own = await tx.unsafe(`SELECT profile_id FROM ${schema}.admin_access`);
        expect(own).toEqual([{ profile_id: ADMIN }]);
        expect(
          await tx.unsafe(
            `SELECT * FROM ${schema}.admin_access WHERE profile_id = '${OTHER_ADMIN}'`
          )
        ).toHaveLength(0);
        await expectDenied(
          tx,
          `INSERT INTO ${schema}.admin_access (profile_id) VALUES ('${MEMBER}')`
        );
        await expectDenied(tx, `UPDATE ${schema}.admin_access SET profile_id = '${MEMBER}'`);
        await expectDenied(tx, `DELETE FROM ${schema}.admin_access WHERE profile_id = '${ADMIN}'`);
        await expectDenied(tx, `TRUNCATE ${schema}.admin_access`);
        await expectDenied(
          tx,
          `INSERT INTO ${schema}.admin_access (profile_id) VALUES ('${ADMIN}') ON CONFLICT (profile_id) DO UPDATE SET granted_at = now()`
        );

        await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: "migration_member", role: "authenticated" })}, true)`;
        expect(await tx.unsafe(`SELECT * FROM ${schema}.admin_access`)).toHaveLength(0);

        await tx.unsafe("SET LOCAL ROLE anon");
        await expectDenied(tx, `SELECT * FROM ${schema}.admin_access`);
        await expectDenied(
          tx,
          `INSERT INTO ${schema}.admin_access (profile_id) VALUES ('${MEMBER}')`
        );

        await tx.unsafe("SET LOCAL ROLE service_role");
        await tx.unsafe(`DELETE FROM ${schema}.admin_access WHERE profile_id = '${ADMIN}'`);
        await tx.unsafe("SET LOCAL ROLE authenticated");
        await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: "migration_admin", role: "authenticated" })}, true)`;
        expect(await tx.unsafe(`SELECT * FROM ${schema}.admin_access`)).toHaveLength(0);

        await tx.unsafe("SET LOCAL ROLE service_role");
        await tx.unsafe(`DELETE FROM ${schema}.profiles WHERE id = '${OTHER_ADMIN}'`);
        expect(await tx.unsafe(`SELECT * FROM ${schema}.admin_access`)).toHaveLength(0);

        throw rolledBack;
      });
    } catch (error) {
      if (error !== rolledBack) throw error;
    } finally {
      await db.close();
    }
  },
  15_000
);
