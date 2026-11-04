import { describe, expect, mock, test } from "bun:test";

import { releaseAfterStream } from "@/lib/chat/release-after-stream";

describe("stream admission lifecycle", () => {
  test("client cancellation holds the lease until the source finishes", async () => {
    let sourceController!: ReadableStreamDefaultController<string>;
    const source = new ReadableStream<string>({
      start(c) {
        sourceController = c;
      },
    });
    const release = mock(async () => {});
    const stream = releaseAfterStream(source, release);

    await stream.cancel();
    sourceController.enqueue("still generating");
    await Promise.resolve();
    expect(release).not.toHaveBeenCalled();
    sourceController.close();
    await Bun.sleep(0);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("source errors release the lease and propagate", async () => {
    const failure = new Error("provider failed");
    const source = new ReadableStream<string>({
      start(c) {
        c.error(failure);
      },
    });
    const release = mock(async () => {});
    const reader = releaseAfterStream(source, release).getReader();

    await expect(reader.read()).rejects.toBe(failure);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("empty responses release the lease", async () => {
    const source = new ReadableStream<string>({
      start(c) {
        c.close();
      },
    });
    const release = mock(async () => {});

    expect(await releaseAfterStream(source, release).getReader().read()).toEqual({
      done: true,
      value: undefined,
    });
    expect(release).toHaveBeenCalledTimes(1);
  });
});
