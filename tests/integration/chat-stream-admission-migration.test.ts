import { expect, test } from "bun:test";
import { SQL, type TransactionSQL } from "bun";

// Explicit test database only; never fall back to application credentials.
// Like admin-access-migration.test.ts, this requires Supabase's database roles
// and a connection allowed to create schemas and SET ROLE. All changes roll back.
const databaseUrl = process.env.CHAT_STREAM_ADMISSION_TEST_DATABASE_URL;
const databaseTest = databaseUrl ? test : test.skip;
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THREAD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MISSING = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

async function expectPermissionDenied(tx: TransactionSQL, query: string) {
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

databaseTest(
  "stream admission verifies ownership and restricts admission to the service role",
  async () => {
    const db = new SQL(databaseUrl!);
    const schema = `stream_admission_test_${crypto.randomUUID().replaceAll("-", "")}`;
    const rollback = new Error("Roll back stream admission fixtures");
    const migration = await Bun.file(
      new URL("../../docs/migrations/chat_stream_admission.sql", import.meta.url)
    ).text();

    try {
      await db.begin(async (tx) => {
        await tx
          .unsafe(
            `
            CREATE SCHEMA ${schema};
            GRANT USAGE ON SCHEMA ${schema} TO anon, authenticated, service_role;
            CREATE TABLE ${schema}.profiles (id uuid PRIMARY KEY);
            CREATE TABLE ${schema}.threads (
              id uuid PRIMARY KEY,
              owner_id uuid NOT NULL REFERENCES ${schema}.profiles(id)
            );
            INSERT INTO ${schema}.profiles VALUES ('${OWNER}'), ('${OTHER}');
            INSERT INTO ${schema}.threads VALUES ('${THREAD}', '${OWNER}');
          `
          )
          .simple();
        await tx
          .unsafe(
            migration
              .replace(/^BEGIN;$/gm, "")
              .replace(/^COMMIT;$/gm, "")
              .replaceAll("public.", `${schema}.`)
          )
          .simple();

        const acquire = (owner: string, thread: string, token: string) =>
          `SELECT ${schema}.acquire_chat_stream_lease('${owner}', '${thread}', '${token}') AS result`;
        const leases = () => tx.unsafe(`SELECT * FROM ${schema}.chat_stream_leases`);
        const rejectedToken = crypto.randomUUID();
        const acceptedToken = crypto.randomUUID();

        await tx.unsafe("SET LOCAL ROLE service_role");
        // Another real account must not reserve this owner's thread.
        expect(await tx.unsafe(acquire(OTHER, THREAD, rejectedToken))).toEqual([
          { result: "not_found" },
        ]);
        expect(await leases()).toHaveLength(0);
        // Missing threads and missing profiles must not create reservations either.
        expect(await tx.unsafe(acquire(OWNER, MISSING, rejectedToken))).toEqual([
          { result: "not_found" },
        ]);
        expect(await tx.unsafe(acquire(MISSING, THREAD, rejectedToken))).toEqual([
          { result: "not_found" },
        ]);
        expect(await leases()).toHaveLength(0);

        expect(await tx.unsafe(acquire(OWNER, THREAD, acceptedToken))).toEqual([
          { result: "acquired" },
        ]);
        const held = await leases();
        expect(held).toHaveLength(1);
        expect(held[0]).toMatchObject({
          thread_id: THREAD,
          owner_id: OWNER,
          token: acceptedToken,
        });
        // Unauthorized admission must not reveal busy status or alter an existing lease.
        expect(await tx.unsafe(acquire(OTHER, THREAD, rejectedToken))).toEqual([
          { result: "not_found" },
        ]);
        expect(await leases()).toEqual(held);
        expect(await tx.unsafe(acquire(OWNER, THREAD, crypto.randomUUID()))).toEqual([
          { result: "busy" },
        ]);
        expect(await leases()).toEqual(held);

        // Even supplying a valid owner's ID cannot bypass service-role-only admission.
        for (const role of ["anon", "authenticated"]) {
          await tx.unsafe(`SET LOCAL ROLE ${role}`);
          await expectPermissionDenied(tx, acquire(OWNER, THREAD, rejectedToken));
          await expectPermissionDenied(tx, `SELECT * FROM ${schema}.chat_stream_leases`);
          await expectPermissionDenied(tx, `DELETE FROM ${schema}.chat_stream_leases`);
        }
        await tx.unsafe("SET LOCAL ROLE service_role");
        expect(await leases()).toEqual(held);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.close();
    }
  },
  15_000
);
