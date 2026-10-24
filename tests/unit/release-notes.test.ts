import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import {
  normalizeSha,
  parseReleaseNotesCacheKey,
  releaseNotesCacheKey,
} from "@/lib/release-notes/cache-key";
import {
  assertPromptExcludesUserContent,
  type GenerateReleaseNotesInput,
  type GenerateReleaseNotesResult,
} from "@/lib/release-notes/generate";
import { parseGitLog, formatCommitLogForPrompt } from "@/lib/release-notes/git-log";
import {
  buildReleaseNotesUserPrompt,
  RELEASE_NOTES_SYSTEM_PROMPT,
} from "@/lib/release-notes/prompts";
import { createSingleFlight } from "@/lib/release-notes/single-flight";
import { getOrGenerateReleaseNotes } from "@/lib/release-notes/service";
import type { ReleaseNotesCachePayload } from "@/lib/schemas/release-notes";

describe("releaseNotesCacheKey", () => {
  test("keys on the SHA pair, not version labels", () => {
    expect(
      releaseNotesCacheKey({
        fromSha: "abc123def",
        toSha: "fed987cba",
      })
    ).toBe("abc123def:fed987cba");
  });

  test("normalizes case and whitespace", () => {
    expect(
      releaseNotesCacheKey({
        fromSha: "  ABC123  ",
        toSha: "Fed987",
      })
    ).toBe("abc123:fed987");
    expect(normalizeSha("AbC")).toBe("abc");
  });

  test("parseReleaseNotesCacheKey round-trips", () => {
    const key = releaseNotesCacheKey({ fromSha: "aaa", toSha: "bbb" });

    expect(parseReleaseNotesCacheKey(key)).toEqual({ fromSha: "aaa", toSha: "bbb" });
    expect(parseReleaseNotesCacheKey("nocolon")).toBeNull();
  });
});

describe("release notes prompt excludes user content", () => {
  test("system prompt grounds the model on commits only", () => {
    expect(RELEASE_NOTES_SYSTEM_PROMPT).toContain("commit list");
    expect(RELEASE_NOTES_SYSTEM_PROMPT).toMatch(/Do not invent/i);
  });

  test("user prompt is only the commit list between SHAs", () => {
    const prompt = buildReleaseNotesUserPrompt({
      fromSha: "aaa111",
      toSha: "bbb222",
      fromVersion: "0.14.0",
      toVersion: "0.14.1",
      commitLog: "- aaa Add release notes page\n  Paths: app/release-notes/page.tsx",
    });

    expect(prompt).toContain("Public git commits");
    expect(prompt).toContain("app/release-notes/page.tsx");
    expect(prompt).not.toMatch(/"role"\s*:\s*"user"/i);
    expect(prompt).not.toMatch(/chat history:/i);
    expect(prompt).not.toMatch(/mem0/i);
    expect(assertPromptExcludesUserContent(prompt)).toBe(true);
  });
});

describe("parseGitLog", () => {
  test("attaches name-only paths to the preceding commit", () => {
    const raw = [
      `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\x1fBump patch\x1f\x1e`,
      `\npackage.json\n\n`,
      `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\x1fMerge PR\x1fBody line\x1e`,
      `\napp/page.tsx\nlib/x.ts\n`,
    ].join("");

    const commits = parseGitLog(raw);

    expect(commits).toHaveLength(2);
    expect(commits[0]?.paths).toEqual(["package.json"]);
    expect(commits[1]?.subject).toBe("Merge PR");
    expect(commits[1]?.body).toBe("Body line");
    expect(commits[1]?.paths).toEqual(["app/page.tsx", "lib/x.ts"]);
  });
});

describe("getOrGenerateReleaseNotes", () => {
  const sampleNotes = {
    headline: "Polished the board",
    summary: "Presence and Ergon feel calmer.",
    highlights: [{ title: "Presence", detail: "Softer glow." }],
  };

  const samplePayload = (fromSha: string, toSha: string): ReleaseNotesCachePayload => ({
    fromSha,
    toSha,
    fromVersion: "0.14.0",
    toVersion: "0.14.1",
    commitCount: 2,
    notes: sampleNotes,
    model: "openai/gpt-6-luna",
    generatedAt: "2026-09-26T00:00:00.000Z",
  });

  test("does not call the model when the SHA pair is already cached", async () => {
    const generate = mock(async (): Promise<GenerateReleaseNotesResult> => {
      throw new Error("model should not run");
    });
    const getCached = mock(async () => samplePayload("fromsha1", "tosha1"));
    const upsertCached = mock(async () => ({ error: null }));
    const listCommits = mock(async () => {
      throw new Error("git should not run on cache hit");
    });

    const result = await getOrGenerateReleaseNotes(
      {
        fromSha: "fromsha1",
        toSha: "tosha1",
        fromVersion: "0.14.0",
        toVersion: "0.14.1",
      },
      { getCached, upsertCached, listCommits, generate }
    );

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.cached).toBe(true);
      expect(result.payload.notes.headline).toBe("Polished the board");
    }
    expect(generate).toHaveBeenCalledTimes(0);
    expect(listCommits).toHaveBeenCalledTimes(0);
  });

  test("a second request for the same SHA pair does not call the model again", async () => {
    let cache: ReleaseNotesCachePayload | null = null;
    const generate = mock(
      async (_input: GenerateReleaseNotesInput): Promise<GenerateReleaseNotesResult> => ({
        notes: sampleNotes,
        model: "openai/gpt-6-luna",
      })
    );

    const deps = {
      getCached: mock(async () => cache),
      upsertCached: mock(async (payload: ReleaseNotesCachePayload) => {
        cache = payload;

        return { error: null };
      }),
      listCommits: mock(async () => ({
        ok: true as const,
        commits: [
          {
            sha: "cccccccccccccccccccccccccccccccccccccccc",
            subject: "Add feature",
            body: "",
            paths: ["app/x.tsx"],
          },
        ],
      })),
      generate,
      singleFlight: createSingleFlight<Awaited<ReturnType<typeof getOrGenerateReleaseNotes>>>(),
    };

    const first = await getOrGenerateReleaseNotes(
      {
        fromSha: "fromsha2",
        toSha: "tosha2",
        fromVersion: "0.14.0",
        toVersion: "0.14.1",
      },
      deps
    );
    const second = await getOrGenerateReleaseNotes(
      {
        fromSha: "fromsha2",
        toSha: "tosha2",
        fromVersion: "0.14.0",
        toVersion: "0.14.1",
      },
      deps
    );

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    if (first.status === "ok" && second.status === "ok") {
      expect(first.cached).toBe(false);
      expect(second.cached).toBe(true);
    }
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("single-flight joins concurrent callers on the same SHA pair", async () => {
    let resolveGenerate!: (value: GenerateReleaseNotesResult) => void;
    const generateStarted = Promise.withResolvers<void>();
    const generate = mock(async (): Promise<GenerateReleaseNotesResult> => {
      generateStarted.resolve();

      return new Promise((resolve) => {
        resolveGenerate = resolve;
      });
    });

    const flight = createSingleFlight<Awaited<ReturnType<typeof getOrGenerateReleaseNotes>>>();
    const deps = {
      getCached: mock(async () => null),
      upsertCached: mock(async () => ({ error: null })),
      listCommits: mock(async () => ({
        ok: true as const,
        commits: [
          {
            sha: "dddddddddddddddddddddddddddddddddddddddd",
            subject: "Concurrent",
            body: "",
            paths: [],
          },
        ],
      })),
      generate,
      singleFlight: flight,
    };

    const args = {
      fromSha: "fromsha3",
      toSha: "tosha3",
      fromVersion: "0.13.0",
      toVersion: "0.14.0",
    };

    const p1 = getOrGenerateReleaseNotes(args, deps);
    const p2 = getOrGenerateReleaseNotes(args, deps);

    await generateStarted.promise;
    expect(generate).toHaveBeenCalledTimes(1);
    expect(flight.has(releaseNotesCacheKey({ fromSha: "fromsha3", toSha: "tosha3" }))).toBe(
      true
    );

    resolveGenerate({ notes: sampleNotes, model: "openai/gpt-6-luna" });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.status).toBe("ok");
    expect(r2.status).toBe("ok");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("notes are not generated until getOrGenerateReleaseNotes is asked", async () => {
    const generate = mock(
      async (): Promise<GenerateReleaseNotesResult> => ({
        notes: sampleNotes,
        model: "openai/gpt-6-luna",
      })
    );

    // Importing / constructing deps must not call generate.
    expect(generate).toHaveBeenCalledTimes(0);

    await getOrGenerateReleaseNotes(
      {
        fromSha: "fromsha4",
        toSha: "tosha4",
        fromVersion: null,
        toVersion: "0.1.0",
      },
      {
        getCached: async () => null,
        upsertCached: async () => ({ error: null }),
        listCommits: async () => ({
          ok: true,
          commits: [
            {
              sha: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
              subject: "Init",
              body: "",
              paths: [],
            },
          ],
        }),
        generate,
        singleFlight: createSingleFlight(),
      }
    );

    expect(generate).toHaveBeenCalledTimes(1);
    const input = generate.mock.calls[0]?.[0] as GenerateReleaseNotesInput;

    expect(input.commitLog).toContain("Init");
    expect(assertPromptExcludesUserContent(buildReleaseNotesUserPrompt(input))).toBe(true);
    expect(formatCommitLogForPrompt([{ sha: "ee", subject: "Init", body: "", paths: [] }])).not.toMatch(
      /user/i
    );
  });

  test("honest empty state when git fails — does not invent notes", async () => {
    const generate = mock(async (): Promise<GenerateReleaseNotesResult> => {
      throw new Error("should not generate");
    });

    const result = await getOrGenerateReleaseNotes(
      {
        fromSha: "fromsha5",
        toSha: "tosha5",
        fromVersion: "0.1.0",
        toVersion: "0.2.0",
      },
      {
        getCached: async () => null,
        upsertCached: async () => ({ error: null }),
        listCommits: async () => ({
          ok: false,
          commits: [],
          error: "fatal: bad revision",
        }),
        generate,
        singleFlight: createSingleFlight(),
      }
    );

    expect(result.status).toBe("empty");
    if (result.status === "empty") {
      expect(result.reason).toBe("git_failed");
    }
    expect(generate).toHaveBeenCalledTimes(0);
  });
});
