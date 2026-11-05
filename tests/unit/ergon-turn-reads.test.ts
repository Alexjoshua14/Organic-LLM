import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { setUserConnectorsRepoForTests } from "@/lib/connectors/user-connectors-repo";
import { saveUserConnectorsProfile } from "@/lib/connectors/user-connectors-store";
import { loadUserConnectorsForTurn } from "@/lib/connectors/durable-ergon-status";
import { saveErgonConnectionRecord } from "@/lib/connectors/ergon-connection-store";
import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { startErgonConnectionSnapshot } from "@/lib/llm/ergon-config";
import { createErgonAgentTools } from "@/lib/llm/ergon-agent-tools";
import { createErgonTicketTools } from "@/lib/llm/ergon-ticket-tools";
import { createMemoryUserConnectorsRepo } from "../helpers/user-connectors-memory-repo";
import {
  ERGON_TEST_OWNER,
  ERGON_TEST_STRANGER,
  installConnectedErgon,
  uninstallConnectedErgon,
} from "../helpers/ergon-connected";

/**
 * Round trips are the latency cost that matters on the turn's critical path, so these assert read
 * counts rather than timings: one Ergon read and one profile read per turn, shared by every
 * consumer, and no network work (token refresh) while tools are being registered.
 */
const gets = (log: string[]) => log.filter((entry) => entry.startsWith("get:")).length;

let ergonRepo: Awaited<ReturnType<typeof installConnectedErgon>>;
let connectorsRepo: ReturnType<typeof createMemoryUserConnectorsRepo>;

beforeEach(async () => {
  ergonRepo = await installConnectedErgon();
  connectorsRepo = createMemoryUserConnectorsRepo();
  setUserConnectorsRepoForTests(connectorsRepo);
  await saveUserConnectorsProfile(ERGON_TEST_OWNER, { careerHistory: "Organic LLM" });
  ergonRepo.log.length = 0;
  connectorsRepo.log.length = 0;
});

afterEach(() => {
  uninstallConnectedErgon();
  setUserConnectorsRepoForTests(null);
});

const compile = (ergonConnection?: Promise<never> | ReturnType<typeof startErgonConnectionSnapshot>) =>
  compileChatTools({
    useSearch: false,
    useMemory: false,
    experience: "arcadia",
    sbUserId: ERGON_TEST_OWNER,
    ergonConnection,
  });

describe("per-turn read budget", () => {
  test("a compiled turn makes exactly one Ergon read, shared by the tool gate and the worktable", async () => {
    const snapshot = startErgonConnectionSnapshot(ERGON_TEST_OWNER);
    const [connectors, compiled] = await Promise.all([
      loadUserConnectorsForTurn(ERGON_TEST_OWNER, snapshot),
      compile(snapshot),
    ]);

    expect(Object.keys(compiled.tools)).toContain("ergon_save_issue");
    expect(connectors?.ergonConnection?.connected).toBe(true);
    expect(connectors?.careerHistory).toBe("Organic LLM");
    expect(gets(ergonRepo.log)).toBe(1);
    expect(gets(connectorsRepo.log)).toBe(1);
  });

  test("compiling on its own still costs a single Ergon read", async () => {
    await compile();

    expect(gets(ergonRepo.log)).toBe(1);
  });

  test("a user without an Ergon connection gets no tools from one read", async () => {
    const compiled = await compileChatTools({
      useSearch: false,
      useMemory: false,
      experience: "arcadia",
      sbUserId: ERGON_TEST_STRANGER,
    });

    expect(Object.keys(compiled.tools).some((name) => name.startsWith("ergon_"))).toBe(false);
    expect(gets(ergonRepo.log)).toBe(1);
  });

  test("registering tools never refreshes an expired token or claims a lock", async () => {
    await saveErgonConnectionRecord(ERGON_TEST_OWNER, {
      url: "https://ergon.example.com",
      token: "expired-access",
      refreshToken: "refresh",
      scopes: ["read", "write", "agents"],
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    ergonRepo.log.length = 0;

    const tickets = await createErgonTicketTools(ERGON_TEST_OWNER);
    const agents = await createErgonAgentTools(ERGON_TEST_OWNER);

    expect(Object.keys(tickets)).toContain("ergon_save_issue");
    expect(Object.keys(agents)).toContain("ergon_start_agent_run");
    expect(ergonRepo.log.some((entry) => entry.startsWith("claim:"))).toBe(false);
    expect(ergonRepo.log.some((entry) => entry.startsWith("rotate:"))).toBe(false);
  });

  test("a store outage drops the tools for the turn without throwing", async () => {
    ergonRepo.get = async () => {
      throw new Error("down");
    };

    const compiled = await compile();

    expect(Object.keys(compiled.tools).some((name) => name.startsWith("ergon_"))).toBe(false);
  });
});
