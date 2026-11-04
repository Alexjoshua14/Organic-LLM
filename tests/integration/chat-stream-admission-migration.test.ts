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

const MIGRATIONS = [
  "chat_stream_admission.sql",
  "chat_stream_subagent_allotment.sql",
  "chat_stream_lease_retention.sql",
];

/** Admission migrations, in order, retargeted at `schema` and unwrapped from BEGIN/COMMIT. */
async function migrationSql(schema: string): Promise<string> {
  const files = await Promise.all(
    MIGRATIONS.map((name) =>
      Bun.file(new URL(`../../docs/migrations/${name}`, import.meta.url)).text()
    )
  );

  return files
    .join("\n")
    .replace(/^BEGIN;$/gm, "")
    .replace(/^COMMIT;$/gm, "")
    .replaceAll("public.", `${schema}.`);
}

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
        await tx.unsafe(await migrationSql(schema)).simple();

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
          await expectPermissionDenied(
            tx,
            `SELECT ${schema}.acquire_subagent_stream_lease('${OWNER}', '${THREAD}', '${MISSING}', '${rejectedToken}')`
          );
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

// Concurrency needs two real connections and committed fixtures, so this test cannot run inside
// one rolled-back transaction. It owns a uniquely named schema and drops it afterwards.
databaseTest(
  "stream admission serializes concurrent requests, caps leases, and recovers expired ones",
  async () => {
    const schema = `stream_admission_race_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new SQL({ url: databaseUrl!, max: 1 });
    const first = new SQL({ url: databaseUrl!, max: 1 });
    const second = new SQL({ url: databaseUrl!, max: 1 });
    const threads = Array.from({ length: 7 }, () => crypto.randomUUID());
    const acquire = (thread: string, token = crypto.randomUUID()) =>
      `SELECT ${schema}.acquire_chat_stream_lease('${OWNER}', '${thread}', '${token}') AS result`;
    const leaseCount = async () =>
      Number(
        (await admin.unsafe(`SELECT count(*)::int AS n FROM ${schema}.chat_stream_leases`))[0].n
      );

    /**
     * Holds `first`'s admission open in a transaction while `second` races it, and checks that
     * `second` waits for the commit instead of reading the pre-commit lease count.
     */
    async function race(firstThread: string, secondThread: string) {
      let contender: Promise<unknown> | undefined;

      await first.begin(async (tx) => {
        expect(await tx.unsafe(acquire(firstThread))).toEqual([{ result: "acquired" }]);
        contender = second.unsafe(acquire(secondThread));
        const state = await Promise.race([
          contender.then(() => "finished"),
          Bun.sleep(300).then(() => "waiting"),
        ]);

        expect(state).toBe("waiting");
      });

      return contender!;
    }

    try {
      await admin
        .unsafe(
          `
          CREATE SCHEMA ${schema};
          CREATE TABLE ${schema}.profiles (id uuid PRIMARY KEY);
          CREATE TABLE ${schema}.threads (
            id uuid PRIMARY KEY,
            owner_id uuid NOT NULL REFERENCES ${schema}.profiles(id)
          );
          INSERT INTO ${schema}.profiles VALUES ('${OWNER}');
          INSERT INTO ${schema}.threads VALUES ${threads.map((id) => `('${id}', '${OWNER}')`).join(", ")};
        `
        )
        .simple();
      await admin.unsafe(await migrationSql(schema)).simple();

      // Two sends to one thread at once: exactly one turn is admitted.
      expect(await race(threads[0], threads[0])).toEqual([{ result: "busy" }]);
      expect(await leaseCount()).toBe(1);

      for (const thread of threads.slice(1, 4)) {
        expect(await admin.unsafe(acquire(thread))).toEqual([{ result: "acquired" }]);
      }
      expect(await leaseCount()).toBe(4);

      // One slot left and two threads competing for it: the loser sees the winner's lease.
      expect(await race(threads[4], threads[5])).toEqual([{ result: "capacity" }]);
      expect(await leaseCount()).toBe(5);

      // A crashed turn's lease expires; the next admission removes it and takes the slot.
      await admin.unsafe(
        `UPDATE ${schema}.chat_stream_leases SET expires_at = clock_timestamp() - interval '1 second'
         WHERE thread_id = '${threads[0]}'`
      );
      expect(await admin.unsafe(acquire(threads[5]))).toEqual([{ result: "acquired" }]);
      expect(
        await admin.unsafe(
          `SELECT 1 FROM ${schema}.chat_stream_leases WHERE thread_id = '${threads[0]}'`
        )
      ).toHaveLength(0);
      expect(await leaseCount()).toBe(5);

      // Release is token-scoped (lib/chat/stream-admission.ts): a stale holder removes nothing.
      const token = crypto.randomUUID();

      await admin.unsafe(
        `DELETE FROM ${schema}.chat_stream_leases WHERE thread_id = '${threads[0]}'`
      );
      expect(await admin.unsafe(acquire(threads[0], token))).toEqual([{ result: "capacity" }]);
      await admin.unsafe(
        `DELETE FROM ${schema}.chat_stream_leases WHERE thread_id = '${threads[1]}'`
      );
      expect(await admin.unsafe(acquire(threads[0], token))).toEqual([{ result: "acquired" }]);
      const release = (releaseToken: string) =>
        admin.unsafe(
          `DELETE FROM ${schema}.chat_stream_leases
           WHERE owner_id = '${OWNER}' AND thread_id = '${threads[0]}' AND token = '${releaseToken}'
           RETURNING thread_id`
        );

      expect(await release(crypto.randomUUID())).toHaveLength(0);
      expect(await release(token)).toHaveLength(1);
    } finally {
      await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await Promise.all([admin.close(), first.close(), second.close()]);
    }
  },
  30_000
);

databaseTest(
  "subagents use their orchestrator's allotment, and admission does not block profile inserts",
  async () => {
    const schema = `stream_admission_subagents_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new SQL({ url: databaseUrl!, max: 1 });
    const first = new SQL({ url: databaseUrl!, max: 1 });
    const second = new SQL({ url: databaseUrl!, max: 1 });
    const ids = (n: number) => Array.from({ length: n }, () => crypto.randomUUID());
    const orchestrators = ids(6);
    const workers = ids(8);
    const foreignThread = crypto.randomUUID();
    const [o1, o2, o3, o4, o5, o6] = orchestrators;
    const chat = (thread: string) =>
      admin.unsafe(
        `SELECT ${schema}.acquire_chat_stream_lease('${OWNER}', '${thread}', '${crypto.randomUUID()}') AS result`
      );
    const subagent = (parent: string, worker: string) =>
      admin.unsafe(
        `SELECT ${schema}.acquire_subagent_stream_lease('${OWNER}', '${parent}', '${worker}', '${crypto.randomUUID()}') AS result`
      );
    const drop = (where: string) =>
      admin.unsafe(`DELETE FROM ${schema}.chat_stream_leases WHERE ${where}`);
    const ACQUIRED = [{ result: "acquired" }];
    const CAPACITY = [{ result: "capacity" }];

    try {
      await admin
        .unsafe(
          `
          CREATE SCHEMA ${schema};
          CREATE TABLE ${schema}.profiles (id uuid PRIMARY KEY);
          CREATE TABLE ${schema}.threads (
            id uuid PRIMARY KEY,
            owner_id uuid NOT NULL REFERENCES ${schema}.profiles(id)
          );
          INSERT INTO ${schema}.profiles VALUES ('${OWNER}'), ('${OTHER}');
          INSERT INTO ${schema}.threads VALUES
            ${[...orchestrators, ...workers].map((id) => `('${id}', '${OWNER}')`).join(", ")},
            ('${foreignThread}', '${OTHER}');
        `
        )
        .simple();
      await admin.unsafe(await migrationSql(schema)).simple();

      // Five workers per orchestrator; the sixth waits.
      expect(await chat(o1)).toEqual(ACQUIRED);
      for (const worker of workers.slice(0, 5))
        expect(await subagent(o1, worker)).toEqual(ACQUIRED);
      expect(await subagent(o1, workers[5])).toEqual(CAPACITY);

      // The orchestrator's own reply ends; it stays active while its workers run.
      await drop(`thread_id = '${o1}'`);
      for (const thread of [o2, o3, o4, o5]) expect(await chat(thread)).toEqual(ACQUIRED);
      expect(await chat(o6)).toEqual(CAPACITY);

      // The waiting orchestrator is not busy, and messaging it takes no extra slot.
      expect(await chat(o1)).toEqual(ACQUIRED);
      expect(await chat(o1)).toEqual([{ result: "busy" }]);

      // A worker under an already-active orchestrator is admitted at the thread cap.
      await drop(`thread_id = '${workers[0]}'`);
      expect(await subagent(o2, workers[0])).toEqual(ACQUIRED);

      // Once o1 is fully idle, a late worker would re-activate it: a sixth thread is refused.
      await drop(`thread_id = '${o1}' OR parent_thread_id = '${o1}'`);
      expect(await chat(o6)).toEqual(ACQUIRED);
      expect(await subagent(o1, workers[6])).toEqual(CAPACITY);

      // Ownership: another account's thread can't be a parent; a thread can't parent itself.
      expect(await subagent(foreignThread, workers[7])).toEqual([{ result: "not_found" }]);
      expect(await subagent(o2, o2)).toEqual([{ result: "not_found" }]);

      // Lock strength: an in-flight admission must not block inserts that reference the profile.
      await drop(`owner_id = '${OWNER}'`);
      await first.begin(async (tx) => {
        expect(
          await tx.unsafe(
            `SELECT ${schema}.acquire_chat_stream_lease('${OWNER}', '${o1}', '${crypto.randomUUID()}') AS result`
          )
        ).toEqual(ACQUIRED);
        const insert = second.unsafe(
          `INSERT INTO ${schema}.threads VALUES ('${crypto.randomUUID()}', '${OWNER}')`
        );
        const state = await Promise.race([
          insert.then(() => "finished"),
          Bun.sleep(1_000).then(() => "blocked"),
        ]);

        expect(state).toBe("finished");
      });
    } finally {
      await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await Promise.all([admin.close(), first.close(), second.close()]);
    }
  },
  30_000
);

databaseTest("deleted threads retain active capacity until token release or expiry", async () => {
  const db = new SQL(databaseUrl!);
  const schema = `stream_retention_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const rollback = new Error("Roll back lease retention fixtures");
  const parents = Array.from({ length: 6 }, () => crypto.randomUUID());
  const worker = crypto.randomUUID();
  const workerToken = crypto.randomUUID();

  try {
    await db.begin(async (tx) => {
      await tx
        .unsafe(
          `
        CREATE SCHEMA ${schema};
        CREATE TABLE ${schema}.profiles (id uuid PRIMARY KEY);
        CREATE TABLE ${schema}.threads (
          id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES ${schema}.profiles(id)
        );
        INSERT INTO ${schema}.profiles VALUES ('${OWNER}');
        INSERT INTO ${schema}.threads VALUES
          ${[...parents, worker].map((id) => `('${id}', '${OWNER}')`).join(", ")};
      `
        )
        .simple();
      await tx.unsafe(await migrationSql(schema)).simple();
      const chat = (thread: string) =>
        tx.unsafe(
          `SELECT ${schema}.acquire_chat_stream_lease('${OWNER}', '${thread}', '${crypto.randomUUID()}') AS result`
        );

      expect(
        await tx.unsafe(
          `SELECT ${schema}.acquire_subagent_stream_lease('${OWNER}', '${parents[0]}', '${worker}', '${workerToken}') AS result`
        )
      ).toEqual([{ result: "acquired" }]);
      for (const parent of parents.slice(1, 5)) {
        expect(await chat(parent)).toEqual([{ result: "acquired" }]);
      }
      // Deleting either endpoint must not erase the running worker's reservation.
      await tx.unsafe(`DELETE FROM ${schema}.threads WHERE id IN ('${parents[0]}', '${worker}')`);
      expect(
        await tx.unsafe(
          `SELECT token FROM ${schema}.chat_stream_leases WHERE thread_id = '${worker}'`
        )
      ).toEqual([{ token: workerToken }]);
      expect(await chat(parents[5])).toEqual([{ result: "capacity" }]);
      expect(await chat(parents[0])).toEqual([{ result: "not_found" }]);
      expect(
        await tx.unsafe(
          `SELECT ${schema}.acquire_subagent_stream_lease('${OWNER}', '${parents[0]}', '${parents[5]}', '${crypto.randomUUID()}') AS result`
        )
      ).toEqual([{ result: "not_found" }]);
      // A stale release still cannot free the retained lease; its actual token can.
      await tx.unsafe(
        `DELETE FROM ${schema}.chat_stream_leases WHERE owner_id = '${OWNER}' AND thread_id = '${worker}' AND token = '${crypto.randomUUID()}'`
      );
      expect(await chat(parents[5])).toEqual([{ result: "capacity" }]);
      await tx.unsafe(
        `DELETE FROM ${schema}.chat_stream_leases WHERE owner_id = '${OWNER}' AND thread_id = '${worker}' AND token = '${workerToken}'`
      );
      expect(await chat(parents[5])).toEqual([{ result: "acquired" }]);

      // A deleted live chat is also counted, and expiry recovers it if cleanup never runs.
      await tx.unsafe(`DELETE FROM ${schema}.threads WHERE id = '${parents[1]}'`);
      await tx.unsafe(`INSERT INTO ${schema}.threads VALUES ('${MISSING}', '${OWNER}')`);
      expect(await chat(MISSING)).toEqual([{ result: "capacity" }]);
      await tx.unsafe(
        `UPDATE ${schema}.chat_stream_leases SET expires_at = clock_timestamp() - interval '1 second' WHERE thread_id = '${parents[1]}'`
      );
      expect(await chat(MISSING)).toEqual([{ result: "acquired" }]);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await db.close();
  }
});
