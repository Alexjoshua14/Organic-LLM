import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  clearGithubSnapshotCache,
  fetchGithubConnectorSnapshot,
} from "@/lib/connectors/github-connector";
import {
  clearUserConnectorsMemoryStore,
  loadUserConnectorsProfile,
  saveUserConnectorsProfile,
} from "@/lib/connectors/user-connectors-store";
import { formatOrchestratorFragment } from "@/lib/llm/subagents/orchestrator/format-orchestrator-fragment";
import { coderSubagent } from "@/lib/llm/subagents/hard-set/agents/coder";
import { researcherSubagent } from "@/lib/llm/subagents/hard-set/agents/researcher";
import { architectSubagent } from "@/lib/llm/subagents/hard-set/agents/architect";
import {
  formatWorkbenchCompactGuide,
  getWorkbenchManpage,
} from "@/lib/llm/subagents/worktable/manpages";
import { resolveShorthandRef } from "@/lib/llm/subagents/worktable/shorthand";
import {
  formatConnectorSpecialistRouting,
  formatDossierForWorktable,
  formatGithubConnectorForWorktable,
  normalizeGithubProfileUrl,
  normalizeGithubUsername,
  normalizeUserConnectorsProfile,
  specialistForConnectorSlice,
  type UserConnectorsProfile,
} from "@/lib/schemas/user-connectors";

const NOW = "2026-10-21T12:00:00.000Z";

function profile(
  partial: Parameters<typeof normalizeUserConnectorsProfile>[0] = {}
): UserConnectorsProfile {
  return normalizeUserConnectorsProfile({
    githubUrl: "https://github.com/Alexjoshua14",
    linkedinUrl: "https://www.linkedin.com/in/alex",
    educationAndTranscripts: "Williams College — CS and Studio Art",
    careerHistory: "Founder building Organic LLM",
    resumeText: "Engineer resume",
    workingPreferences: "MacBook and aetherion (Raspberry Pi 5)",
    autoShareWithSubagents: true,
    ...partial,
  });
}

describe("GitHub handle normalization", () => {
  test("accepts a profile URL, a host path, and a bare or @ handle", () => {
    for (const raw of [
      "https://github.com/Alexjoshua14",
      "https://github.com/Alexjoshua14/",
      "github.com/Alexjoshua14/organic-llm",
      "@Alexjoshua14",
      "Alexjoshua14",
    ]) {
      expect(normalizeGithubUsername(raw)).toBe("Alexjoshua14");
    }
    expect(normalizeGithubProfileUrl("github.com/Alexjoshua14/")).toBe(
      "https://github.com/Alexjoshua14"
    );
  });

  test("rejects other hosts, empty paths, and illegal usernames", () => {
    expect(normalizeGithubUsername("https://evil.example/Alexjoshua14")).toBe("");
    expect(normalizeGithubUsername("https://github.com/")).toBe("");
    expect(normalizeGithubUsername("a--b")).toBe("");
    expect(normalizeGithubUsername("-ab")).toBe("");
    expect(normalizeGithubProfileUrl("not a user")).toBe("");
  });
});

describe("connector dossier formatting and specialist routing", () => {
  test("maps each shorthand slice to Reed, Lyra, or Archer", () => {
    expect(specialistForConnectorSlice("connector:github")).toEqual({
      agent: "Reed",
      agentId: "agent-coder",
    });
    for (const slice of [
      "connector:dossier",
      "education",
      "connector:career",
      "connector:resume",
    ]) {
      expect(specialistForConnectorSlice(slice)?.agent).toBe("Lyra");
    }
    expect(specialistForConnectorSlice("connector:preferences")?.agentId).toBe(
      "subagent-architect"
    );
    expect(specialistForConnectorSlice("connector:nope")).toBeNull();
  });

  test("formats GitHub and dossier slices and tells the orchestrator who receives them", () => {
    const saved = profile({
      cachedGithubSnapshot: {
        username: "Alexjoshua14",
        profileUrl: "https://github.com/Alexjoshua14",
        fetchedAt: NOW,
        profile: null,
        repos: [
          {
            name: "organic-llm",
            description: "Design lab",
            language: "TypeScript",
            html_url: "https://github.com/Alexjoshua14/organic-llm",
            updated_at: null,
            stargazers_count: 0,
            fork: false,
            topics: [],
          },
        ],
      },
    });
    const github = formatGithubConnectorForWorktable(saved);

    expect(github).toContain("@Alexjoshua14");
    expect(github).toContain("organic-llm");
    expect(github).toContain("Reed");
    expect(github).toContain("Archer");

    const education = formatDossierForWorktable(saved, "education");

    expect(education).toContain("Williams College");
    expect(education).not.toContain("Engineer resume");

    const routing = formatConnectorSpecialistRouting(saved);

    expect(routing).toContain("Reed (agent-coder)");
    expect(routing).toContain("connector:github");
    expect(routing).toContain("Lyra (agent-researcher)");
    expect(routing).toContain("connector:career");
    expect(routing).toContain("Archer (subagent-architect)");
    expect(routing).toContain("connector:preferences");

    const fragment = formatOrchestratorFragment({
      snapshots: [],
      autonomous: false,
      autonomousRemaining: null,
      connectors: saved,
    });

    expect(fragment).toContain("[Connectors]");
    expect(fragment).toContain("Lyra (agent-researcher)");

    expect(
      formatConnectorSpecialistRouting(profile({ autoShareWithSubagents: false }))
    ).toContain("automatic sharing is off");
    expect(formatConnectorSpecialistRouting(normalizeUserConnectorsProfile({}))).toBeNull();
  });

  test("resolveShorthandRef expands slices and stops when sharing is disabled", () => {
    const saved = profile();
    const career = resolveShorthandRef("connector:career", { userConnectors: saved });

    expect(career.ok).toBe(true);
    if (!career.ok || career.kind !== "item") throw new Error("expected career item");
    expect(career.item.sourceRef).toBe("connector:career");
    expect(career.item.text).toContain("Organic LLM");
    expect(career.item.text).toContain("linkedin.com/in/alex");

    const blocked = resolveShorthandRef("connector:resume", {
      userConnectors: profile({ autoShareWithSubagents: false }),
    });

    expect(blocked.ok).toBe(false);
    if (blocked.ok) throw new Error("expected refusal");
    expect(blocked.error).toContain("automatic subagent connector sharing is disabled");

    const missing = resolveShorthandRef("connector:github", { userConnectors: null });

    expect(missing.ok).toBe(false);
  });

  test("the connectors manpage and specialist instructions name the same routes", () => {
    const page = getWorkbenchManpage("connectors");

    expect(page.known).toBe(true);
    expect(page.topic).toBe("connectors");
    expect(page.manpage).toContain("connector:github");
    expect(page.manpage).toContain("connector:dossier");
    expect(page.manpage).toContain("connector:education");
    expect(page.manpage).toContain("connector:career");
    expect(page.manpage).toContain("connector:resume");
    expect(page.manpage).toContain("Reed");
    expect(page.manpage).toContain("Lyra");
    expect(page.manpage).toContain("Archer");
    expect(page.manpage).not.toContain("read_user_connector");
    expect(getWorkbenchManpage("github").topic).toBe("connectors");
    expect(formatWorkbenchCompactGuide()).toContain("connector:github");
    expect(coderSubagent.instructions).toContain("connector:github");
    expect(researcherSubagent.instructions).toContain("connector:career");
    expect(architectSubagent.instructions).toContain("connector:preferences");
  });
});

describe("GitHub public profile helper", () => {
  beforeEach(() => {
    clearGithubSnapshotCache();
  });

  test("fetches only api.github.com and caches the public profile and repos", async () => {
    const fetchImpl = mock(async (input: RequestInfo | URL) => {
      const url = String(input);

      expect(url.startsWith("https://api.github.com/users/Alexjoshua14")).toBe(true);
      if (url.includes("/repos")) {
        return new Response(
          JSON.stringify([
            {
              name: "organic-llm",
              full_name: "Alexjoshua14/organic-llm",
              description: "Design lab",
              language: "TypeScript",
              html_url: "https://github.com/Alexjoshua14/organic-llm",
              updated_at: "2026-10-01T00:00:00Z",
              stargazers_count: 2,
              fork: false,
              topics: ["llm", "bun"],
            },
          ]),
          { status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          login: "Alexjoshua14",
          name: "Alex",
          bio: "Building Organic",
          html_url: "https://github.com/Alexjoshua14",
          public_repos: 3,
          followers: 1,
          company: null,
          location: "Earth",
          blog: "",
        }),
        { status: 200 }
      );
    });

    const first = await fetchGithubConnectorSnapshot("https://github.com/Alexjoshua14/", {
      fetchImpl: fetchImpl as typeof fetch,
      now: () => Date.parse(NOW),
    });

    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error);
    expect(first.cached).toBe(false);
    expect(first.snapshot.username).toBe("Alexjoshua14");
    expect(first.snapshot.repos[0]?.language).toBe("TypeScript");
    expect(first.snapshot.repos[0]?.topics).toEqual(["llm", "bun"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const second = await fetchGithubConnectorSnapshot("Alexjoshua14", {
      fetchImpl: fetchImpl as typeof fetch,
      now: () => Date.parse(NOW),
    });

    expect(second.ok && second.cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("does not call fetch for an invalid handle or a missing user", async () => {
    const fetchImpl = mock(async () => new Response("nope", { status: 500 }));
    const invalid = await fetchGithubConnectorSnapshot("https://example.com/not-github", {
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(invalid.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();

    fetchImpl.mockImplementation(async () => new Response("missing", { status: 404 }));
    const missing = await fetchGithubConnectorSnapshot("nobody-user", {
      fetchImpl: fetchImpl as typeof fetch,
      forceRefresh: true,
    });

    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error("expected 404");
    expect(missing.status).toBe(404);
  });
});

describe("user connectors file store", () => {
  let rootDir: string;

  beforeEach(async () => {
    clearUserConnectorsMemoryStore();
    rootDir = await mkdtemp(path.join(tmpdir(), "organic-connectors-"));
  });

  afterEach(async () => {
    clearUserConnectorsMemoryStore();
    await rm(rootDir, { recursive: true, force: true });
  });

  test("round-trips a private profile for one user without leaking it to another", async () => {
    const saved = await saveUserConnectorsProfile(
      "user_a",
      profile({ educationAndTranscripts: "Linear Algebra and Heliophysics" }),
      { rootDir, now: () => Date.parse(NOW) }
    );

    expect(saved.githubUsername).toBe("Alexjoshua14");
    expect(saved.updatedAt).toBe(NOW);

    const loaded = await loadUserConnectorsProfile("user_a", { rootDir });

    expect(loaded.educationAndTranscripts).toContain("Heliophysics");
    expect(loaded.githubUrl).toBe("https://github.com/Alexjoshua14");

    const other = await loadUserConnectorsProfile("user_b", { rootDir });

    expect(other.educationAndTranscripts).toBe("");
    expect(other.githubUsername).toBe("");
  });
});
