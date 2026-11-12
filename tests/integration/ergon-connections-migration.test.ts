import { expect, test } from "bun:test";
import { SQL, type TransactionSQL } from "bun";

// Explicit test database only; never fall back to application credentials.
// Like chat-stream-admission-migration.test.ts, this needs Supabase's database roles and a
// connection allowed to create schemas and SET ROLE. All changes roll back.
const databaseUrl = process.env.ERGON_CONNECTIONS_TEST_DATABASE_URL;
const databaseTest = databaseUrl ? test : test.skip;
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** The migration, retargeted at `schema` and unwrapped from BEGIN/COMMIT. */
async function migrationSql(schema: string): Promise<string> {
  const sql = await Bun.file(
    new URL("../../docs/migrations/ergon_connections.sql", import.meta.url)
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
  "ergon_connections is service-role only, versioned, locked and constrained",
  async () => {
    const db = new SQL(databaseUrl!);
    const schema = `ergon_connections_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const rollback = new Error("Roll back ergon_connections fixtures");
    const insert = (owner: string, token = "enc:v1:k1:aXY=:dGFn:Y3Q=") =>
      `INSERT INTO ${schema}.ergon_connections
         (owner_id, url, mcp_url, scopes, token_ciphertext)
       VALUES ('${owner}', 'https://ergon.example.com', 'https://ergon.example.com/mcp',
               ARRAY['read','write'], '${token}')`;

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
        await tx.unsafe(insert(OTHER));

        const row = async (owner: string) =>
          (
            await tx.unsafe(
              `SELECT version, refresh_lock_until, updated_at FROM ${schema}.ergon_connections WHERE owner_id = '${owner}'`
            )
          )[0];

        // Version bumps only when a token changes, so touching last_ok_at cannot spoil a
        // concurrent refresh's compare-and-swap.
        expect(Number((await row(OWNER)).version)).toBe(1);
        await tx.unsafe(
          `UPDATE ${schema}.ergon_connections SET last_ok_at = now() WHERE owner_id = '${OWNER}'`
        );
        expect(Number((await row(OWNER)).version)).toBe(1);
        await tx.unsafe(
          `UPDATE ${schema}.ergon_connections SET token_ciphertext = 'enc:v1:k1:aXY=:dGFn:bmV3' WHERE owner_id = '${OWNER}'`
        );
        expect(Number((await row(OWNER)).version)).toBe(2);

        // Compare-and-swap: a stale version matches no row.
        const stale = await tx.unsafe(
          `UPDATE ${schema}.ergon_connections SET token_ciphertext = 'enc:v1:k1:aXY=:dGFn:c3RhbGU='
             WHERE owner_id = '${OWNER}' AND version = 1 RETURNING owner_id`
        );
        expect(stale).toHaveLength(0);

        // The refresh lock is exclusive until it expires, and is per owner.
        const claim = (owner: string, ttl: number) =>
          `SELECT ${schema}.claim_ergon_refresh_lock('${owner}', ${ttl}) AS claimed`;
        expect(await tx.unsafe(claim(OWNER, 1))).toEqual([{ claimed: true }]);
        expect(await tx.unsafe(claim(OWNER, 1))).toEqual([{ claimed: false }]);
        expect(await tx.unsafe(claim(OTHER, 30))).toEqual([{ claimed: true }]);
        expect(await tx.unsafe(claim("cccccccc-cccc-4ccc-8ccc-cccccccccccc", 30))).toEqual([
          { claimed: false },
        ]);
        await tx.unsafe("SELECT pg_sleep(1.2)");
        expect(await tx.unsafe(claim(OWNER, 1))).toEqual([{ claimed: true }]);

        // Constraints: bad scopes, empty tokens and unknown owners are rejected.
        await expectError(
          tx,
          insert("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
          "23503" // foreign key: no such profile
        );
        await tx.unsafe(
          `DELETE FROM ${schema}.ergon_connections WHERE owner_id = '${OTHER}'`
        );
        await expectError(
          tx,
          `INSERT INTO ${schema}.ergon_connections (owner_id, url, mcp_url, scopes, token_ciphertext)
           VALUES ('${OTHER}', 'https://e.example.com', 'https://e.example.com/mcp', ARRAY['admin'], 'enc:x')`,
          "23514"
        );
        await expectError(
          tx,
          `INSERT INTO ${schema}.ergon_connections (owner_id, url, mcp_url, scopes, token_ciphertext)
           VALUES ('${OTHER}', 'https://e.example.com', 'https://e.example.com/mcp', ARRAY['read'], '')`,
          "23514"
        );

        // anon and authenticated can do nothing: no reads, writes, deletes or lock claims, even
        // when they supply a real owner's id.
        for (const role of ["anon", "authenticated"]) {
          await tx.unsafe(`SET LOCAL ROLE ${role}`);
          await expectError(tx, `SELECT * FROM ${schema}.ergon_connections`, "42501");
          await expectError(tx, insert(OTHER), "42501");
          await expectError(
            tx,
            `UPDATE ${schema}.ergon_connections SET last_ok_at = now() WHERE owner_id = '${OWNER}'`,
            "42501"
          );
          await expectError(tx, `DELETE FROM ${schema}.ergon_connections`, "42501");
          await expectError(tx, claim(OWNER, 30), "42501");
        }

        // Deleting the profile removes the stored credentials.
        await tx.unsafe("SET LOCAL ROLE service_role");
        await tx.unsafe(`DELETE FROM ${schema}.profiles WHERE id = '${OWNER}'`);
        expect(
          await tx.unsafe(`SELECT 1 FROM ${schema}.ergon_connections WHERE owner_id = '${OWNER}'`)
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
