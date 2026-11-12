import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";

import * as supabase from "@/lib/supabase/server";
import { readThreadStreamState } from "@/lib/chat/thread-stream-state";

let result: {
  data: { active_stream_id: string | null } | null;
  error: { message: string } | null;
};
const single = mock(async () => result);
const eq = mock(() => ({ single }));
const select = mock(() => ({ eq }));
const from = mock(() => ({ select }));
let restore: () => void;

beforeEach(() => {
  result = { data: { active_stream_id: "live-stream" }, error: null };
  for (const fn of [from, select, eq, single]) fn.mockClear();
  const client = spyOn(supabase, "supabaseServer").mockResolvedValue({ from } as never);
  restore = () => client.mockRestore();
});

afterEach(() => restore());

test("resume reads only the current stream marker through the authenticated client", async () => {
  expect(await readThreadStreamState("thread-a")).toEqual({
    data: { activeStreamId: "live-stream" },
    error: null,
  });
  expect(from.mock.calls).toEqual([["threads"]]);
  expect(select.mock.calls).toEqual([["active_stream_id"]]);
  expect(eq.mock.calls).toEqual([["id", "thread-a"]]);
  expect(single).toHaveBeenCalledTimes(1);
});

test("each request reads fresh state, including a newly started stream", async () => {
  result.data = { active_stream_id: null };
  expect((await readThreadStreamState("thread-a")).data).toEqual({ activeStreamId: null });
  result.data = { active_stream_id: "started-after-page-load" };
  expect((await readThreadStreamState("thread-a")).data).toEqual({
    activeStreamId: "started-after-page-load",
  });
  expect(single).toHaveBeenCalledTimes(2);
});

test("denied and missing threads cannot disclose a stream marker", async () => {
  result = { data: null, error: { message: "Denied" } };
  expect((await readThreadStreamState("other-thread")).data).toBeNull();
  expect((await readThreadStreamState("other-thread")).error?.message).toBe("Denied");
  result = { data: null, error: null };
  expect((await readThreadStreamState("missing")).error).toBeInstanceOf(Error);
});
