import "server-only";

import type { PaintingState } from "@/lib/personas/domains/acrylic/painting-state";
import type { EncryptionContext, EncryptionFieldName } from "@/lib/crypto/message-encryption";

import { randomUUID } from "crypto";

import { z } from "zod";

import {
  PERSONA_LOG_MAX,
  PERSONA_LOG_TEXT_MAX,
  PERSONA_SUBJECT_MAX,
  PersonaLogEntrySchema,
  PersonaSessionSchema,
  type PersonaDomainId,
  type PersonaId,
  type PersonaLogEntry,
  type PersonaSession,
  type PersonaStarterId,
} from "./session";
import { PERSONAS } from "./registry";

import { createLogger } from "@/lib/logger";

/**
 * Persona sessions live in Upstash Redis, encrypted per user with the message-encryption keys,
 * outside the `threads` table: a persona project is not a chat and must not show up in the
 * sidebar, search, or memory ingest. No migration needed. Keys expire after a long idle TTL,
 * refreshed on every write. A durable table can replace this behind the same interface.
 */

const logger = createLogger("lib/personas/unified/store");

const PREFIX = "persona:v1";
const TTL_SECONDS = 120 * 24 * 60 * 60;

const keys = {
  active: (owner: string) => `${PREFIX}:active:${owner}`,
  latest: (owner: string) => `${PREFIX}:latest:${owner}`,
  state: (owner: string, id: string) => `${PREFIX}:state:${owner}:${id}`,
  log: (owner: string, id: string) => `${PREFIX}:log:${owner}:${id}`,
  photo: (owner: string, id: string) => `${PREFIX}:photo:${owner}:${id}`,
};

/** The subset of the Upstash client this store uses; tests pass an in-memory fake. */
export type PersonaRedis = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: string, options?: { ex: number }): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  lpush(key: string, ...values: string[]): Promise<unknown>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]>;
  expire(key: string, seconds: number): Promise<unknown>;
};

type Crypto = {
  encrypt: (plaintext: string, context: EncryptionContext) => string;
  decrypt: (ciphertext: string, context: EncryptionContext) => string;
};

const StoredStateSchema = PersonaSessionSchema.omit({ log: true });

type StoredState = z.infer<typeof StoredStateSchema>;

export type CreatePersonaSessionInput = {
  personaId: PersonaId;
  domainId?: PersonaDomainId;
  starterId?: PersonaStarterId | null;
  subject?: string;
};

export function createPersonaStore(deps: {
  redis: PersonaRedis;
  crypto: Crypto;
  now?: () => Date;
  uuid?: () => string;
}) {
  const now = () => (deps.now ?? (() => new Date()))();
  const context = (
    owner: string,
    id: string,
    fieldName: Extract<EncryptionFieldName, `persona_sessions.${string}`>
  ): EncryptionContext => ({ userId: owner, threadId: `persona:${id}`, fieldName });

  async function readState(owner: string, id: string): Promise<StoredState | null> {
    const raw = await deps.redis.get<string>(keys.state(owner, id));

    if (typeof raw !== "string") return null;
    try {
      const parsed = StoredStateSchema.safeParse(
        JSON.parse(deps.crypto.decrypt(raw, context(owner, id, "persona_sessions.state")))
      );

      return parsed.success ? parsed.data : null;
    } catch (error) {
      logger.warn(
        "readState",
        `Unreadable persona state: ${error instanceof Error ? error.message : error}`
      );

      return null;
    }
  }

  async function writeState(owner: string, state: StoredState): Promise<void> {
    const value = deps.crypto.encrypt(
      JSON.stringify(StoredStateSchema.parse(state)),
      context(owner, state.id, "persona_sessions.state")
    );

    await deps.redis.set(keys.state(owner, state.id), value, { ex: TTL_SECONDS });
    await Promise.all([
      deps.redis.expire(keys.log(owner, state.id), TTL_SECONDS),
      deps.redis.expire(keys.photo(owner, state.id), TTL_SECONDS),
    ]);
  }

  async function readLog(owner: string, id: string): Promise<PersonaLogEntry[]> {
    const raw = await deps.redis.lrange<string>(keys.log(owner, id), 0, PERSONA_LOG_MAX - 1);
    const entries: PersonaLogEntry[] = [];

    // Newest first in Redis; oldest first everywhere else.
    for (const item of [...raw].reverse()) {
      if (typeof item !== "string") continue;
      try {
        const parsed = PersonaLogEntrySchema.safeParse(
          JSON.parse(deps.crypto.decrypt(item, context(owner, id, "persona_sessions.log")))
        );

        if (parsed.success) entries.push(parsed.data);
      } catch {
        // One unreadable entry should not cost the rest of the log.
      }
    }

    return entries;
  }

  async function load(owner: string, id: string): Promise<PersonaSession | null> {
    const [state, log] = await Promise.all([readState(owner, id), readLog(owner, id)]);

    return state ? PersonaSessionSchema.parse({ ...state, log }) : null;
  }

  async function pointer(key: string): Promise<string | null> {
    const id = await deps.redis.get<string>(key);

    return typeof id === "string" && z.uuid().safeParse(id).success ? id : null;
  }

  return {
    load,

    /** The session the user has switched on, if any. */
    async active(owner: string): Promise<PersonaSession | null> {
      const id = await pointer(keys.active(owner));

      return id ? load(owner, id) : null;
    },

    /** The most recent session, active or not, to resume when the persona is switched back on. */
    async latest(owner: string): Promise<PersonaSession | null> {
      const id = await pointer(keys.latest(owner));

      return id ? load(owner, id) : null;
    },

    async create(owner: string, input: CreatePersonaSessionInput): Promise<PersonaSession> {
      const at = now().toISOString();
      const state: StoredState = {
        id: (deps.uuid ?? randomUUID)(),
        personaId: input.personaId,
        domainId: input.domainId ?? PERSONAS[input.personaId].defaultDomain,
        starterId: input.starterId ?? null,
        subject: (input.subject ?? "").trim().slice(0, PERSONA_SUBJECT_MAX),
        work: null,
        createdAt: at,
        updatedAt: at,
      };

      await writeState(owner, state);
      await Promise.all([
        deps.redis.set(keys.active(owner), state.id, { ex: TTL_SECONDS }),
        deps.redis.set(keys.latest(owner), state.id, { ex: TTL_SECONDS }),
      ]);

      return { ...state, log: [] };
    },

    async update(
      owner: string,
      id: string,
      patch: { subject?: string; starterId?: PersonaStarterId | null }
    ): Promise<PersonaSession | null> {
      const state = await readState(owner, id);

      if (!state) return null;
      await writeState(owner, {
        ...state,
        ...(patch.subject !== undefined
          ? { subject: patch.subject.trim().slice(0, PERSONA_SUBJECT_MAX) }
          : {}),
        ...(patch.starterId !== undefined ? { starterId: patch.starterId } : {}),
        updatedAt: now().toISOString(),
      });

      return load(owner, id);
    },

    /** Switches the persona on for `id`, or off with `null`. Off keeps the session to resume. */
    async activate(owner: string, id: string | null): Promise<boolean> {
      if (id === null) {
        await deps.redis.del(keys.active(owner));

        return true;
      }
      if (!(await readState(owner, id))) return false;
      await Promise.all([
        deps.redis.set(keys.active(owner), id, { ex: TTL_SECONDS }),
        deps.redis.set(keys.latest(owner), id, { ex: TTL_SECONDS }),
      ]);

      return true;
    },

    async appendLog(
      owner: string,
      id: string,
      entries: Omit<PersonaLogEntry, "at">[]
    ): Promise<void> {
      const at = now().toISOString();
      const values = entries
        .filter((entry) => entry.text.trim())
        .map((entry) =>
          deps.crypto.encrypt(
            JSON.stringify(
              PersonaLogEntrySchema.parse({
                ...entry,
                at,
                text: entry.text.trim().slice(0, PERSONA_LOG_TEXT_MAX),
              })
            ),
            context(owner, id, "persona_sessions.log")
          )
        );

      if (values.length === 0) return;
      // LPUSH takes values left to right, so reverse to keep the batch's order newest-first.
      await deps.redis.lpush(keys.log(owner, id), ...values.reverse());
      await deps.redis.ltrim(keys.log(owner, id), 0, PERSONA_LOG_MAX - 1);
      await deps.redis.expire(keys.log(owner, id), TTL_SECONDS);
    },

    /** Records a new painting state; `photo` becomes the next comparison's "previous". */
    async saveWork(
      owner: string,
      id: string,
      work: PaintingState,
      photo: string | null
    ): Promise<PersonaSession | null> {
      const state = await readState(owner, id);

      if (!state) return null;
      if (photo) {
        await deps.redis.set(
          keys.photo(owner, id),
          deps.crypto.encrypt(photo, context(owner, id, "persona_sessions.photo")),
          { ex: TTL_SECONDS }
        );
      }
      await writeState(owner, { ...state, work, updatedAt: now().toISOString() });

      return load(owner, id);
    },

    async loadPhoto(owner: string, id: string): Promise<string | null> {
      const raw = await deps.redis.get<string>(keys.photo(owner, id));

      if (typeof raw !== "string") return null;
      try {
        return deps.crypto.decrypt(raw, context(owner, id, "persona_sessions.photo"));
      } catch {
        return null;
      }
    },
  };
}

export type PersonaStore = ReturnType<typeof createPersonaStore>;

let defaultStore: PersonaStore | null = null;

/** The app's store: Upstash Redis plus per-user message encryption. */
export async function getPersonaStore(): Promise<PersonaStore> {
  if (!defaultStore) {
    const [{ redis }, { encryptForStorage, decryptFromStorage }] = await Promise.all([
      import("@/lib/redis/redis"),
      import("@/lib/crypto/message-encryption"),
    ]);

    defaultStore = createPersonaStore({
      redis: redis as unknown as PersonaRedis,
      crypto: { encrypt: encryptForStorage, decrypt: decryptFromStorage },
    });
  }

  return defaultStore;
}
