import { z } from "zod";

const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export const GithubRepoSummarySchema = z.object({
  name: z.string().min(1).max(200),
  full_name: z.string().max(300).optional(),
  description: z.string().max(2_000).nullable().default(null),
  language: z.string().max(120).nullable().default(null),
  html_url: z.string().url().max(500),
  updated_at: z.string().max(80).nullable().default(null),
  stargazers_count: z.number().int().nonnegative().default(0),
  fork: z.boolean().default(false),
  topics: z.array(z.string().max(100)).max(30).default([]),
});

export type GithubRepoSummary = z.infer<typeof GithubRepoSummarySchema>;

export const GithubProfileSummarySchema = z.object({
  login: z.string().min(1).max(80),
  name: z.string().max(200).nullable().default(null),
  bio: z.string().max(1_000).nullable().default(null),
  html_url: z.string().url().max(500),
  public_repos: z.number().int().nonnegative().default(0),
  followers: z.number().int().nonnegative().default(0),
  company: z.string().max(200).nullable().default(null),
  location: z.string().max(200).nullable().default(null),
  blog: z.string().max(500).nullable().default(null),
});

export type GithubProfileSummary = z.infer<typeof GithubProfileSummarySchema>;

export const GithubConnectorSnapshotSchema = z.object({
  username: z.string().min(1).max(80),
  profileUrl: z.string().url().max(500),
  fetchedAt: z.string(),
  profile: GithubProfileSummarySchema.nullable().default(null),
  repos: z.array(GithubRepoSummarySchema).max(50).default([]),
});

export type GithubConnectorSnapshot = z.infer<typeof GithubConnectorSnapshotSchema>;

export const USER_CONNECTORS_LIMITS = {
  handleChars: 300,
  educationChars: 20_000,
  careerChars: 20_000,
  resumeChars: 40_000,
  preferencesChars: 12_000,
} as const;

export const UserConnectorsProfileSchema = z.object({
  githubUrl: z.string().max(USER_CONNECTORS_LIMITS.handleChars).default(""),
  githubUsername: z.string().max(80).default(""),
  linkedinUrl: z.string().max(USER_CONNECTORS_LIMITS.handleChars).default(""),
  websiteUrl: z.string().max(USER_CONNECTORS_LIMITS.handleChars).default(""),
  xHandle: z.string().max(USER_CONNECTORS_LIMITS.handleChars).default(""),
  educationAndTranscripts: z.string().max(USER_CONNECTORS_LIMITS.educationChars).default(""),
  careerHistory: z.string().max(USER_CONNECTORS_LIMITS.careerChars).default(""),
  resumeText: z.string().max(USER_CONNECTORS_LIMITS.resumeChars).default(""),
  workingPreferences: z.string().max(USER_CONNECTORS_LIMITS.preferencesChars).default(""),
  autoShareWithSubagents: z.boolean().default(true),
  cachedGithubSnapshot: GithubConnectorSnapshotSchema.nullable().optional().default(null),
  updatedAt: z.string().nullable().optional().default(null),
});

export type UserConnectorsProfile = z.infer<typeof UserConnectorsProfileSchema>;
export type UserConnectorsProfileInput = z.input<typeof UserConnectorsProfileSchema>;

export function defaultUserConnectorsProfile(): UserConnectorsProfile {
  return {
    githubUrl: "",
    githubUsername: "",
    linkedinUrl: "",
    websiteUrl: "",
    xHandle: "",
    educationAndTranscripts: "",
    careerHistory: "",
    resumeText: "",
    workingPreferences: "",
    autoShareWithSubagents: true,
    cachedGithubSnapshot: null,
    updatedAt: null,
  };
}

/**
 * Normalize a GitHub URL or handle (e.g. `https://github.com/Alexjoshua14`,
 * `github.com/Alexjoshua14/`, `@Alexjoshua14`, or `Alexjoshua14`) into a validated GitHub username.
 * Returns `""` when empty or invalid.
 */
export function normalizeGithubUsername(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";

  if (!trimmed) return "";

  let candidate = trimmed;

  if (
    /^https?:\/\//i.test(trimmed) ||
    /^github\.com\//i.test(trimmed) ||
    /^www\.github\.com\//i.test(trimmed)
  ) {
    try {
      const urlString = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const parsed = new URL(urlString);
      const host = parsed.hostname.toLowerCase();

      if (host !== "github.com" && host !== "www.github.com") {
        return "";
      }
      const segments = parsed.pathname
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);

      candidate = segments[0] ?? "";
    } catch {
      return "";
    }
  } else {
    candidate = trimmed.replace(/^@/, "").split("/")[0]?.trim() ?? "";
  }

  if (!candidate || !GITHUB_USERNAME_RE.test(candidate)) {
    return "";
  }

  return candidate;
}

/**
 * Normalize a GitHub URL or username into a canonical `https://github.com/<username>` URL.
 */
export function normalizeGithubProfileUrl(raw: string | null | undefined): string {
  const username = normalizeGithubUsername(raw);

  return username ? `https://github.com/${username}` : "";
}

/**
 * Parse and normalize a partial or full `UserConnectorsProfile` payload, keeping `githubUsername`
 * and `githubUrl` synchronized when either is provided.
 */
export function normalizeUserConnectorsProfile(
  input: Partial<UserConnectorsProfileInput> | null | undefined,
  existing?: UserConnectorsProfile | null
): UserConnectorsProfile {
  const base = existing
    ? { ...defaultUserConnectorsProfile(), ...existing }
    : defaultUserConnectorsProfile();
  const merged = UserConnectorsProfileSchema.parse({
    ...base,
    ...(input ?? {}),
  });

  const resolvedUsername =
    normalizeGithubUsername(merged.githubUsername) || normalizeGithubUsername(merged.githubUrl);
  const resolvedUrl = resolvedUsername
    ? `https://github.com/${resolvedUsername}`
    : merged.githubUrl.trim();

  return {
    ...merged,
    githubUsername: resolvedUsername,
    githubUrl: resolvedUrl,
    linkedinUrl: merged.linkedinUrl.trim(),
    websiteUrl: merged.websiteUrl.trim(),
    xHandle: merged.xHandle.trim(),
    educationAndTranscripts: merged.educationAndTranscripts.trim(),
    careerHistory: merged.careerHistory.trim(),
    resumeText: merged.resumeText.trim(),
    workingPreferences: merged.workingPreferences.trim(),
  };
}

/**
 * True when the user has saved any meaningful connector handle or dossier section.
 */
export function hasPopulatedConnectorsProfile(
  profile: UserConnectorsProfile | null | undefined
): boolean {
  if (!profile) return false;

  return Boolean(
    profile.githubUsername.trim() ||
      profile.githubUrl.trim() ||
      profile.linkedinUrl.trim() ||
      profile.websiteUrl.trim() ||
      profile.xHandle.trim() ||
      profile.educationAndTranscripts.trim() ||
      profile.careerHistory.trim() ||
      profile.resumeText.trim() ||
      profile.workingPreferences.trim() ||
      (profile.cachedGithubSnapshot?.repos.length ?? 0) > 0
  );
}

/**
 * Format a `GithubConnectorSnapshot` and user GitHub handle into a structured markdown note
 * suitable for `connector:github` on the orchestrator worktable and Reed (`agent-coder`).
 */
export function formatGithubConnectorForWorktable(
  profile: UserConnectorsProfile | null | undefined,
  snapshotOverride?: GithubConnectorSnapshot | null
): string {
  const snapshot = snapshotOverride ?? profile?.cachedGithubSnapshot ?? null;
  const username =
    snapshot?.username ||
    normalizeGithubUsername(profile?.githubUsername) ||
    normalizeGithubUsername(profile?.githubUrl);
  const profileUrl =
    snapshot?.profileUrl ||
    (username ? `https://github.com/${username}` : profile?.githubUrl?.trim() || "");

  const lines: string[] = [];

  lines.push(
    `User GitHub Connector${username ? ` (@${username})` : ""}${profileUrl ? ` — ${profileUrl}` : ""}`
  );
  lines.push(
    "Specialist Routing: Delegate repository/code inspection, architecture review, and implementation questions to Reed (`agent-coder` / `subagent-coder`) or Archer (`subagent-architect`)."
  );

  if (snapshot?.profile) {
    const p = snapshot.profile;
    const meta = [
      p.name ? `Name: ${p.name}` : null,
      p.bio ? `Bio: ${p.bio}` : null,
      p.company ? `Org: ${p.company}` : null,
      p.location ? `Location: ${p.location}` : null,
      `Public Repos: ${p.public_repos}`,
    ].filter(Boolean);

    if (meta.length > 0) {
      lines.push(meta.join(" · "));
    }
  }

  const repos = snapshot?.repos ?? [];

  if (repos.length > 0) {
    lines.push(`Public Repositories (${repos.length} synced):`);
    for (const repo of repos.slice(0, 20)) {
      const lang = repo.language ? ` [${repo.language}]` : "";
      const desc = repo.description?.trim() ? ` — ${repo.description.trim()}` : "";
      const topics =
        repo.topics && repo.topics.length > 0
          ? ` (topics: ${repo.topics.slice(0, 6).join(", ")})`
          : "";
      const updated = repo.updated_at ? ` · updated ${repo.updated_at.slice(0, 10)}` : "";

      lines.push(`- ${repo.name}${lang} (${repo.html_url})${desc}${topics}${updated}`);
    }
  } else if (username) {
    lines.push(
      `Configured GitHub handle: @${username} (${profileUrl}). Public repositories can be inspected via https://github.com/${username} or synced in Settings → Connectors.`
    );
  }

  return lines.join("\n");
}

export type DossierSliceTarget =
  | "dossier"
  | "profile"
  | "all"
  | "education"
  | "transcripts"
  | "career"
  | "history"
  | "projects"
  | "resume"
  | "cv"
  | "preferences"
  | "infra"
  | "stack";

/**
 * Format the user's Personal Dossier (or a specific slice like `education`, `career`, `resume`, `preferences`)
 * for the orchestrator worktable (`connector:dossier`, `connector:education`, `connector:career`, etc.).
 */
export function formatDossierForWorktable(
  profile: UserConnectorsProfile,
  target: DossierSliceTarget = "dossier"
): string {
  const normalizedTarget = target.toLowerCase() as DossierSliceTarget;
  const lines: string[] = [];

  const includeHandles =
    normalizedTarget === "dossier" ||
    normalizedTarget === "profile" ||
    normalizedTarget === "all" ||
    normalizedTarget === "career";
  const includeEducation =
    normalizedTarget === "dossier" ||
    normalizedTarget === "profile" ||
    normalizedTarget === "all" ||
    normalizedTarget === "education" ||
    normalizedTarget === "transcripts";
  const includeCareer =
    normalizedTarget === "dossier" ||
    normalizedTarget === "profile" ||
    normalizedTarget === "all" ||
    normalizedTarget === "career" ||
    normalizedTarget === "history" ||
    normalizedTarget === "projects";
  const includeResume =
    normalizedTarget === "dossier" ||
    normalizedTarget === "profile" ||
    normalizedTarget === "all" ||
    normalizedTarget === "resume" ||
    normalizedTarget === "cv";
  const includePreferences =
    normalizedTarget === "dossier" ||
    normalizedTarget === "profile" ||
    normalizedTarget === "all" ||
    normalizedTarget === "preferences" ||
    normalizedTarget === "infra" ||
    normalizedTarget === "stack";

  lines.push(`User Personal Dossier (${normalizedTarget})`);

  if (includeHandles) {
    const handles: string[] = [];

    if (profile.githubUsername || profile.githubUrl) {
      handles.push(
        `GitHub: ${profile.githubUsername ? `@${profile.githubUsername}` : ""}${profile.githubUrl ? ` (${profile.githubUrl})` : ""}`.trim()
      );
    }
    if (profile.linkedinUrl) handles.push(`LinkedIn: ${profile.linkedinUrl}`);
    if (profile.websiteUrl) handles.push(`Website: ${profile.websiteUrl}`);
    if (profile.xHandle) handles.push(`X/Social: ${profile.xHandle}`);

    if (handles.length > 0) {
      lines.push("Connected Profiles:");
      for (const h of handles) {
        lines.push(`- ${h}`);
      }
    }
  }

  if (includeEducation && profile.educationAndTranscripts.trim()) {
    lines.push("Education & Transcripts:");
    lines.push(profile.educationAndTranscripts.trim());
  }

  if (includeCareer && profile.careerHistory.trim()) {
    lines.push("Career History & Systems Built:");
    lines.push(profile.careerHistory.trim());
  }

  if (includeResume && profile.resumeText.trim()) {
    lines.push("Resume / CV:");
    lines.push(profile.resumeText.trim());
  }

  if (includePreferences && profile.workingPreferences.trim()) {
    lines.push("Working & Infrastructure Preferences:");
    lines.push(profile.workingPreferences.trim());
  }

  if (
    (normalizedTarget === "dossier" ||
      normalizedTarget === "profile" ||
      normalizedTarget === "all") &&
    (profile.githubUsername || profile.cachedGithubSnapshot)
  ) {
    lines.push(formatGithubConnectorForWorktable(profile));
  }

  return lines.join("\n\n");
}

/**
 * Specialist routing for private profile grounding.
 * Reed reads GitHub/code, Lyra reads research and career slices, Archer reads architecture prefs.
 */
export const CONNECTOR_SPECIALIST_ROUTES = [
  {
    agent: "Reed",
    agentId: "agent-coder",
    role: "Coding & Repos",
    shorthand: ["connector:github"],
    description:
      "Inspects your public GitHub repositories, languages, topics, and code structure before proposing implementations.",
    when: "GitHub, repositories, and code",
  },
  {
    agent: "Lyra",
    agentId: "agent-researcher",
    role: "Research & Career",
    shorthand: ["connector:dossier", "connector:education", "connector:career", "connector:resume"],
    description:
      "Grounds research and synthesis in your education, transcripts, career history, resume, and LinkedIn.",
    when: "Research, education, career, resume, and LinkedIn",
  },
  {
    agent: "Archer",
    agentId: "subagent-architect",
    role: "System Architecture",
    shorthand: ["connector:preferences"],
    description:
      "Designs systems around your hardware, home servers, stack conventions, and infrastructure constraints.",
    when: "Architecture and infrastructure preferences",
  },
] as const;

export type ConnectorSpecialistRoute = (typeof CONNECTOR_SPECIALIST_ROUTES)[number];

/** Map a `connector:<slice>` token to the specialist who should receive it. */
export function specialistForConnectorSlice(
  slice: string
): Pick<ConnectorSpecialistRoute, "agent" | "agentId"> | null {
  const token = slice.trim().toLowerCase();
  const normalized = token.startsWith("connector:") ? token : `connector:${token}`;
  const route = CONNECTOR_SPECIALIST_ROUTES.find((entry) =>
    (entry.shorthand as readonly string[]).includes(normalized)
  );

  return route ? { agent: route.agent, agentId: route.agentId } : null;
}

/**
 * Orchestrator system note. Empty when the user has not saved grounding, or a refusal when
 * automatic sharing is off.
 */
export function formatConnectorSpecialistRouting(
  profile: UserConnectorsProfile | null | undefined
): string | null {
  if (!profile || !hasPopulatedConnectorsProfile(profile)) return null;

  if (profile.autoShareWithSubagents === false) {
    return [
      "[Connectors]",
      "The user has private profile grounding in Settings → Connectors, and automatic sharing is off. Do not attach connector:* shorthand unless they explicitly ask you to use that dossier.",
    ].join("\n");
  }

  const lines = [
    "[Connectors]",
    "The user saved private profile grounding in Settings → Connectors. Dispatch the specialist and attach only the shorthand slice they need. Do not paste the dossier into the brief.",
  ];

  for (const route of CONNECTOR_SPECIALIST_ROUTES) {
    lines.push(
      `- ${route.when} → ${route.agent} (${route.agentId}). shorthand: ${route.shorthand.join(", ")}`
    );
  }

  return lines.join("\n");
}
