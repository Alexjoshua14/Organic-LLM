import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import { recordHeartbeatRun } from "@/data/supabase/heartbeat-runs";
import { createHeartbeatTelemetry } from "@/lib/llm/subagents/heartbeat/telemetry";
import { Logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

const row = () =>
  createHeartbeatTelemetry({
    ownerId: "owner",
    threadId: "00000000-0000-4000-8000-000000000001",
  }).finish("unchanged");

afterEach(() => mock.restore());

describe("heartbeat telemetry persistence", () => {
  test("writes only allowlisted fields with a bounded abort signal", async () => {
    const abortSignal = mock(async (_signal: AbortSignal) => ({ error: null }));
    const insert = mock((_data: unknown) => ({ abortSignal }));
    const from = spyOn(supabaseAdmin, "from").mockReturnValue({ insert } as never);
    const run = row();
    await recordHeartbeatRun({ ...run, prompt: "private-content" } as typeof run);
    expect(from).toHaveBeenCalledWith("heartbeat_runs");
    expect(insert).toHaveBeenCalledWith(run);
    expect(abortSignal).toHaveBeenCalledTimes(1);
    expect(abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(insert.mock.calls)).not.toContain("private-content");
  });

  test("returned database errors do not reject or log provider/error content", async () => {
    const warn = spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    spyOn(supabaseAdmin, "from").mockReturnValue({
      insert: () => ({
        abortSignal: async () => ({ error: { message: "private-content" } }),
      }),
    } as never);
    const run = row();
    await recordHeartbeatRun(run);
    expect(warn).toHaveBeenCalledWith(
      "recordHeartbeatRun",
      "Heartbeat telemetry insert failed",
      run.id
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-content");
  });

  test("thrown transport failures do not reject or expose exception text", async () => {
    const warn = spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    spyOn(supabaseAdmin, "from").mockImplementation(() => {
      throw new Error("secret-url");
    });
    await recordHeartbeatRun(row());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-url");
  });
});
