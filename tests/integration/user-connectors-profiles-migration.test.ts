import { expect, test } from "bun:test";
import { SQL, type TransactionSQL } from "bun";

// Explicit test database only; never fall back to application credentials.
// Like ergon-connections-migration.test.ts, this needs Supabase's database roles and a connection
// allowed to create schemas and SET ROLE. All changes roll back.
const databaseUrl = process.env.USER_CONNECTORS_TEST_DATABASE_URL;
const databaseTest = databaseUrl ? test : test.skip;
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MISSING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/** The migration, retargeted at `schema` and unwrapped from BEGIN/COMMIT. */
async function migrationSql(schema: string): Promise<string> {
  const sql = await Bun.file(
    new URL("../../docs/migrations/user_connectors_profiles.sql", import.meta.url)
  ).text();

  return sql
    .replace(/^BEGIN;$/gm, "")
    .replace(/^COMMIT;$/gm, "")
    .replaceAll("public.", `${schema}.`);
}

async function expectError(tx: TransactionSQL, query: string, errno: string) {
  let failure: unknown;

  try {
    await tx.savepoint(async (savepoint) => {
      await savepoint.unsafe(query);
    });
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ errno });
}

databaseTest(
  "user_connectors_profiles is service-role only, versioned and constrained",
  async () => {
    const db = new SQL(databaseUrl!);
    const schema = `user_connectors_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const rollback = new Error("Roll back user_connectors_profiles fixtures");
    const insert = (owner: string, payload = "enc:v1:k1:aXY=:dGFn:Y3Q=") =>
      `INSERT INTO ${schema}.user_connectors_profiles (owner_id, payload_ciphertext)
       VALUES ('${owner}', '${payload}')`;

    try {
      await db.begin(async (tx) => {
        await tx
          .unsafe(
            `
            CREATE SCHEMA ${schema};
            GRANT USAGE ON SCHEMA ${schema} TO anon, authenticated, service_role;
            CREATE TABLE ${schema}.profiles (id uuid PRIMARY KEY);
            GRANT SELECT, DELETE ON ${schema}.profiles TO service_role;
            INSERT INTO ${schema}.profiles VALUES ('${OWNER}'), ('${OTHER}');
          `
          )
          .simple();
        await tx.unsafe(await migrationSql(schema)).simple();

        await tx.unsafe("SET LOCAL ROLE service_role");
        await tx.unsafe(insert(OWNER));

        const version = async () =>
          Number(
            (
              await tx.unsafe(
                `SELECT version FROM ${schema}.user_connectors_profiles WHERE owner_id = '${OWNER}'`
              )
            )[0].version
          );

        // The version bumps only when the payload changes.
        expect(await version()).toBe(1);
        await tx.unsafe(
          `UPDATE ${schema}.user_connectors_profiles SET payload_ciphertext = payload_ciphertext WHERE owner_id = '${OWNER}'`
        );
        expect(await version()).toBe(1);
        await tx.unsafe(
          `UPDATE ${schema}.user_connectors_profiles SET payload_ciphertext = 'enc:v1:k1:aXY=:dGFn:bmV3' WHERE owner_id = '${OWNER}'`
        );
        expect(await version()).toBe(2);

        // Compare-and-swap: a stale version matches no row.
        expect(
          await tx.unsafe(
            `UPDATE ${schema}.user_connectors_profiles SET payload_ciphertext = 'enc:v1:k1:aXY=:dGFn:c3RhbGU='
               WHERE owner_id = '${OWNER}' AND version = 1 RETURNING owner_id`
          )
        ).toHaveLength(0);

        // One row per profile; unknown profiles and empty payloads are rejected.
        await expectError(tx, insert(OWNER), "23505");
        await expectError(tx, insert(MISSING), "23503");
        await expectError(tx, insert(OTHER, ""), "23514");
        await expectError(tx, insert(OTHER, "x".repeat(400_001)), "23514");

        // anon and authenticated can do nothing, even when they supply a real owner's id.
        for (const role of ["anon", "authenticated"]) {
          await tx.unsafe(`SET LOCAL ROLE ${role}`);
          await expectError(tx, `SELECT * FROM ${schema}.user_connectors_profiles`, "42501");
          await expectError(tx, insert(OTHER), "42501");
          await expectError(
            tx,
            `UPDATE ${schema}.user_connectors_profiles SET payload_ciphertext = 'x' WHERE owner_id = '${OWNER}'`,
            "42501"
          );
          await expectError(tx, `DELETE FROM ${schema}.user_connectors_profiles`, "42501");
        }

        // Deleting the profile deletes its stored data.
        await tx.unsafe("SET LOCAL ROLE service_role");
        await tx.unsafe(`DELETE FROM ${schema}.profiles WHERE id = '${OWNER}'`);
        expect(
          await tx.unsafe(
            `SELECT 1 FROM ${schema}.user_connectors_profiles WHERE owner_id = '${OWNER}'`
          )
        ).toHaveLength(0);

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
