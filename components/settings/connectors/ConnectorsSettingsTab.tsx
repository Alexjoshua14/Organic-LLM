"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Globe,
  Link2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";

import { DOSSIER_FIELDS, DossierFieldEditor } from "./DossierFieldEditor";

import { QuickSettingRow } from "@/components/settings/quick-setting-row";
import { SettingsHelp } from "@/components/settings/settings-help";
import { Switch } from "@/components/design-system/switch";
import { caption } from "@/components/design-system/primitives";
import {
  CONNECTOR_SPECIALIST_ROUTES,
  defaultUserConnectorsProfile,
  normalizeGithubProfileUrl,
  normalizeGithubUsername,
  normalizeUserConnectorsProfile,
  UserConnectorsProfileSchema,
  type GithubConnectorSnapshot,
  type UserConnectorsProfile,
} from "@/lib/schemas/user-connectors";
import {
  DEFAULT_ERGON_MCP_URL,
  ErgonConnectionPublicSchema,
  toPublicErgonConnection,
  type ErgonConnectionPublic,
} from "@/lib/schemas/ergon-connection";
import { getUserConnectors, setUserConnectors } from "@/lib/user-settings";

export type ConnectorsSettingsTabProps = {
  initialProfile?: Partial<UserConnectorsProfile>;
  onSave?: (profile: UserConnectorsProfile) => void;
  fetchImpl?: typeof fetch;
};

export function ConnectorsSettingsTab({
  initialProfile,
  onSave,
  fetchImpl,
}: ConnectorsSettingsTabProps = {}) {
  const [formState, setFormState] = useState<UserConnectorsProfile>(() =>
    normalizeUserConnectorsProfile(initialProfile, getUserConnectors())
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [syncingGithub, setSyncingGithub] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [githubSnapshot, setGithubSnapshot] = useState<GithubConnectorSnapshot | null>(
    () => formState.cachedGithubSnapshot ?? null
  );

  const [ergonStatus, setErgonStatus] = useState<ErgonConnectionPublic>(
    () => formState.ergonConnection ?? toPublicErgonConnection(null)
  );
  const [ergonBusy, setErgonBusy] = useState(false);
  const [ergonError, setErgonError] = useState<string | null>(null);
  const [ergonSetupDetails, setErgonSetupDetails] = useState<string | null>(null);

  const doFetch = useMemo(() => fetchImpl ?? fetch, [fetchImpl]);

  useEffect(() => {
    if (initialProfile) return;
    const local = getUserConnectors();

    setFormState(local);
    if (local.cachedGithubSnapshot) {
      setGithubSnapshot(local.cachedGithubSnapshot);
    }

    let cancelled = false;

    async function hydrateFromServer() {
      try {
        const res = await doFetch("/api/profile/connectors");

        if (!res.ok) return;
        const payload = (await res.json().catch(() => ({}))) as { data?: unknown };
        const parsed = UserConnectorsProfileSchema.safeParse(payload.data);

        if (!cancelled && parsed.success) {
          const remote = parsed.data;
          const local = getUserConnectors();
          const hasRemoteContent = Boolean(
            remote.githubUsername ||
              remote.githubUrl ||
              remote.linkedinUrl ||
              remote.websiteUrl ||
              remote.educationAndTranscripts ||
              remote.careerHistory ||
              remote.resumeText ||
              remote.workingPreferences
          );
          const localStamp = Date.parse(local.updatedAt ?? "") || 0;
          const remoteStamp = Date.parse(remote.updatedAt ?? "") || 0;

          if (hasRemoteContent && remoteStamp >= localStamp) {
            const merged = setUserConnectors(remote);

            setFormState(merged);
            if (merged.cachedGithubSnapshot) {
              setGithubSnapshot(merged.cachedGithubSnapshot);
            }
            if (merged.ergonConnection) {
              setErgonStatus(merged.ergonConnection);
            }
          }
        }
      } catch {
        // Offline or unauthenticated: local settings remain authoritative.
      }

      try {
        const ergonRes = await doFetch("/api/profile/connectors/ergon");

        if (!ergonRes.ok || cancelled) return;
        const ergonPayload = (await ergonRes.json().catch(() => ({}))) as { data?: unknown };
        const ergonParsed = ErgonConnectionPublicSchema.safeParse(ergonPayload.data);

        if (!cancelled && ergonParsed.success) {
          const status = ergonParsed.data;

          setErgonStatus(status);
          setFormState((prev) =>
            setUserConnectors({
              ...prev,
              ergonConnection: status.connected ? status : null,
            })
          );
        }
      } catch {
        // Ergon status is optional when offline.
      }
    }

    void hydrateFromServer();

    return () => {
      cancelled = true;
    };
  }, [doFetch, initialProfile]);

  const normalizedGithubHandle = useMemo(
    () =>
      normalizeGithubUsername(formState.githubUrl) ||
      normalizeGithubUsername(formState.githubUsername),
    [formState.githubUrl, formState.githubUsername]
  );

  const updateField = useCallback(
    <K extends keyof UserConnectorsProfile>(key: K, value: UserConnectorsProfile[K]) => {
      setFormState((prev) => {
        const next = { ...prev, [key]: value };

        if (key === "githubUrl" && typeof value === "string") {
          const handle = normalizeGithubUsername(value);

          next.githubUsername = handle;
        } else if (key === "githubUsername" && typeof value === "string") {
          const handle = normalizeGithubUsername(value);

          next.githubUsername = handle;
          if (handle) {
            next.githubUrl = normalizeGithubProfileUrl(handle);
          }
        }

        return next;
      });
      setIsDirty(true);
      setSaveMessage(null);
      setSaveError(null);
    },
    []
  );

  const handleSave = useCallback(
    async (override?: Partial<UserConnectorsProfile>) => {
      setSaving(true);
      setSaveError(null);
      setSaveMessage(null);

      const candidate = normalizeUserConnectorsProfile(
        {
          ...formState,
          ...(githubSnapshot ? { cachedGithubSnapshot: githubSnapshot } : {}),
          ...(override ?? {}),
        },
        defaultUserConnectorsProfile()
      );

      const savedLocal = setUserConnectors(candidate);

      setFormState(savedLocal);
      setIsDirty(false);
      onSave?.(savedLocal);

      try {
        const res = await doFetch("/api/profile/connectors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(savedLocal),
        });

        if (res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { data?: unknown };
          const parsed = UserConnectorsProfileSchema.safeParse(payload.data);

          if (parsed.success) {
            const synced = setUserConnectors(parsed.data);

            setFormState(synced);
          }
          setSaveMessage("Saved to private profile & synced with subagent workbench");
        } else {
          setSaveMessage("Saved locally to private profile");
        }
      } catch {
        setSaveMessage("Saved locally to private profile");
      } finally {
        setSaving(false);
      }
    },
    [doFetch, formState, githubSnapshot, onSave]
  );

  const handleConnectErgonOAuth = useCallback(async () => {
    setErgonBusy(true);
    setErgonError(null);
    setErgonSetupDetails(null);

    try {
      const res = await doFetch("/api/profile/connectors/ergon/oauth/start", {
        headers: { Accept: "application/json" },
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { authorizeUrl?: string };
        error?: string;
        oauthReady?: boolean;
      };

      if (res.status === 503 || payload.oauthReady === false) {
        setErgonError("Ergon isn’t available yet. Ask an admin to finish setup.");
        setErgonSetupDetails(
          payload.error ??
            "Configure the Ergon OAuth client ID and redirect URL on this deployment."
        );
        setErgonBusy(false);

        return;
      }

      if (!res.ok) {
        throw new Error(payload.error ?? "Could not start Ergon OAuth.");
      }

      const authorizeUrl = payload.data?.authorizeUrl;

      if (!authorizeUrl) {
        throw new Error("Ergon OAuth start did not return an authorize URL.");
      }

      window.location.assign(authorizeUrl);
    } catch (error) {
      setErgonError(error instanceof Error ? error.message : "Could not start Ergon OAuth.");
      setErgonBusy(false);
    }
  }, [doFetch]);

  const handleDisconnectErgon = useCallback(async () => {
    setErgonBusy(true);
    setErgonError(null);
    setErgonSetupDetails(null);

    try {
      const res = await doFetch("/api/profile/connectors/ergon", { method: "DELETE" });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: unknown;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(payload.error ?? "Could not disconnect Ergon.");
      }

      const parsed = ErgonConnectionPublicSchema.safeParse(payload.data);
      const next = parsed.success ? parsed.data : toPublicErgonConnection(null);

      setErgonStatus(next);
      await handleSave({ ergonConnection: next.connected ? next : null });
      setSaveMessage(
        next.source === "env"
          ? "Disconnected your Ergon OAuth session. Admin env bridge still applies for this account."
          : "Disconnected Ergon. Reconnect with OAuth to restore Mira and ticket tools."
      );
    } catch (error) {
      setErgonError(error instanceof Error ? error.message : "Could not disconnect Ergon.");
    } finally {
      setErgonBusy(false);
    }
  }, [doFetch, handleSave]);

  const handleSyncGithub = useCallback(async () => {
    const rawTarget = formState.githubUrl.trim() || formState.githubUsername.trim();
    const username = normalizeGithubUsername(rawTarget);

    if (!username) {
      setGithubError(
        "Enter a valid GitHub username (e.g. coalescence-labs) or profile URL (https://github.com/coalescence-labs) first."
      );

      return;
    }

    setSyncingGithub(true);
    setGithubError(null);

    try {
      const res = await doFetch(
        `/api/profile/connectors/github?username=${encodeURIComponent(username)}&refresh=1`
      );
      const payload = (await res.json().catch(() => ({}))) as {
        data?: GithubConnectorSnapshot;
        error?: string;
      };

      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? `Failed to sync GitHub repos for @${username}`);
      }

      const snapshot = payload.data;

      setGithubSnapshot(snapshot);
      await handleSave({
        githubUsername: snapshot.username,
        githubUrl: snapshot.profileUrl,
        cachedGithubSnapshot: snapshot,
      });
      setSaveMessage(
        `Synced ${snapshot.repos.length} public repositories for @${snapshot.username}`
      );
    } catch (error) {
      setGithubError(
        error instanceof Error ? error.message : "Could not sync GitHub repositories."
      );
    } finally {
      setSyncingGithub(false);
    }
  }, [doFetch, formState, handleSave]);

  return (
    <div className="flex flex-col gap-stack-2xl">
      <div className="flex flex-col gap-inline-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-stack-xs">
          <h2 className="text-xl font-semibold text-foreground">Connectors & Personal Dossier</h2>
          <p className={caption({ className: "max-w-xl" })}>
            Connect accounts and add background for more relevant help.
          </p>
        </div>
        <div className="flex items-center gap-inline-sm shrink-0 pt-1">
          <button
            className="inline-flex items-center gap-inline-sm rounded-lg bg-foreground px-inset-lg py-inset-sm text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={saving}
            type="button"
            onClick={() => void handleSave()}
          >
            <CheckCircle2 className="size-3.5" />
            {saving ? "Saving..." : "Save Connectors & Dossier"}
          </button>
        </div>
      </div>

      {saveMessage && (
        <div
          className="flex items-center gap-inline-sm rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-inset-lg py-inset-md text-xs text-emerald-700 dark:text-emerald-300"
          role="status"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {saveError && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-inset-lg py-inset-md text-xs text-destructive"
          role="alert"
        >
          {saveError}
        </div>
      )}

      {isDirty && !saveMessage && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          You have unsaved connector or dossier edits. Click &ldquo;Save Connectors &amp;
          Dossier&rdquo; to persist them.
        </p>
      )}

      {/* Sharing stays visible; routing details are optional. */}
      <section className="rounded-xl border border-border/70 bg-muted/20 p-inset-lg">
        <div className="flex items-center justify-between gap-inline-md">
          <div className="flex items-center gap-inline-sm">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-foreground" />
            <h3 className="text-sm font-medium text-foreground" id="connector-sharing-label">
              Share relevant context with specialists
            </h3>
          </div>
          <Switch
            aria-label="Automatically share connectors with subagents"
            aria-describedby="connector-sharing-label"
            isSelected={formState.autoShareWithSubagents}
            onValueChange={(enabled) => {
              updateField("autoShareWithSubagents", enabled);
              void handleSave({ autoShareWithSubagents: enabled });
            }}
          />
        </div>
        <SettingsHelp title="How sharing works">
          <p>
            {formState.autoShareWithSubagents
              ? "Specialists receive only the profile context relevant to the current task."
              : "Specialists will not receive automatic connector slices. You can still share context in chat."}
          </p>
          <div className="grid gap-inline-md sm:grid-cols-3">
            {CONNECTOR_SPECIALIST_ROUTES.map((entry) => (
              <div
                key={entry.agentId}
                className="space-y-stack-xs rounded-lg border border-border/60 bg-background/80 p-inset-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-semibold text-foreground">{entry.agent}</span>
                  <span className="font-mono text-[10px]">{entry.role}</span>
                </div>
                <p className="font-mono text-[10px]">{entry.shorthand.join(" · ")}</p>
                <p className="text-[11px] leading-snug">{entry.description}</p>
              </div>
            ))}
          </div>
        </SettingsHelp>
      </section>

      {/* Connected Accounts Card */}
      <section className="rounded-xl border border-border/70 bg-background p-inset-lg space-y-stack-lg">
        <div className="space-y-stack-xs">
          <div className="flex items-center gap-inline-sm">
            <Globe className="size-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Connected Profiles &amp; Handles
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">Manage the accounts Organic can use.</p>
        </div>

        <div className="space-y-stack-lg">
          {/* Ergon — MCP OAuth (product path for Mira + ticket tools) */}
          <div className="space-y-stack-xs rounded-lg border border-border/60 bg-muted/10 p-inset-lg">
            <div className="flex flex-wrap items-center justify-between gap-inline-sm">
              <div className="flex items-center gap-inline-sm text-xs font-medium text-foreground">
                <Link2 className="size-3.5 text-muted-foreground" />
                Ergon
              </div>
              {ergonStatus.connected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-3" />
                  Connected
                  {ergonStatus.authMode === "oauth" ? " · OAuth" : ""}
                  {ergonStatus.source === "env" ? " · admin" : ""}
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  Not connected
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Connect your workspace to work on tickets.
            </p>
            <SettingsHelp title="Connection details">
              <p>
                Ergon connects through OAuth. Access and refresh tokens stay on the server. Mira
                uses this connection to plan work; editing tickets requires write access.
              </p>
              <p>
                MCP endpoint:{" "}
                <code>{ergonStatus.mcpUrl ?? ergonStatus.url ?? DEFAULT_ERGON_MCP_URL}</code>
              </p>
              {ergonStatus.connected && (
                <div className="space-y-stack-xs">
                  {(ergonStatus.authMode || ergonStatus.transport) && (
                    <p>
                      {[
                        ergonStatus.authMode ? `Auth: ${ergonStatus.authMode}` : null,
                        ergonStatus.transport ? `Transport: ${ergonStatus.transport}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {ergonStatus.scopes.length > 0 && <p>Scopes: {ergonStatus.scopes.join(", ")}</p>}
                  {ergonStatus.connectedAt && (
                    <p>Connected {new Date(ergonStatus.connectedAt).toLocaleString()}</p>
                  )}
                </div>
              )}
            </SettingsHelp>

            {ergonStatus.connected ? (
              <div className="space-y-stack-xs">
                {ergonStatus.source === "user" && (
                  <button
                    aria-label="Disconnect Ergon"
                    className="inline-flex items-center justify-center gap-inline-sm rounded-lg border border-border bg-muted/40 px-inset-md py-inset-sm text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    disabled={ergonBusy}
                    type="button"
                    onClick={() => void handleDisconnectErgon()}
                  >
                    <Unplug className="size-3.5" />
                    {ergonBusy ? "Disconnecting…" : "Disconnect Ergon"}
                  </button>
                )}
              </div>
            ) : (
              <button
                aria-label="Connect Ergon with OAuth"
                className="inline-flex w-full items-center justify-center gap-inline-sm rounded-lg border border-border bg-foreground px-inset-md py-inset-sm text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                disabled={ergonBusy}
                type="button"
                onClick={() => void handleConnectErgonOAuth()}
              >
                <Link2 className={`size-3.5 ${ergonBusy ? "animate-pulse" : ""}`} />
                {ergonBusy ? "Connecting…" : "Connect Ergon"}
              </button>
            )}

            {ergonError && (
              <div
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-inset-md py-inset-sm text-xs text-destructive"
                role="alert"
              >
                <p>{ergonError}</p>
                {ergonSetupDetails && (
                  <SettingsHelp title="Setup details">{ergonSetupDetails}</SettingsHelp>
                )}
              </div>
            )}
          </div>

          {/* GitHub */}
          <div className="space-y-stack-xs">
            <div className="[&_h3]:text-xs">
              <QuickSettingRow
                caption="Reed uses your public repositories to help with coding tasks. Only relevant GitHub context is shared when automatic sharing is on."
                icon={
                  <GitBranch
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                }
                label="GitHub Profile URL or Username"
              >
                {normalizedGithubHandle && (
                  <span className="rounded-full bg-muted px-inset-sm py-0.5 font-mono text-[11px] text-foreground">
                    @{normalizedGithubHandle}
                  </span>
                )}
              </QuickSettingRow>
            </div>
            <div className="flex flex-col gap-inline-sm sm:flex-row">
              <input
                className="flex-1 rounded-lg border border-border bg-background px-inset-md py-inset-sm text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                aria-label="GitHub Profile URL or Username"
                id="connector-github-url"
                placeholder="https://github.com/coalescence-labs or coalescence-labs"
                type="text"
                value={formState.githubUrl}
                onChange={(e) => updateField("githubUrl", e.target.value)}
              />
              <button
                aria-label="Test / Sync GitHub Repos"
                className="inline-flex items-center justify-center gap-inline-sm rounded-lg border border-border bg-muted/40 px-inset-md py-inset-sm text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                disabled={syncingGithub}
                type="button"
                onClick={() => void handleSyncGithub()}
              >
                <RefreshCw className={`size-3.5 ${syncingGithub ? "animate-spin" : ""}`} />
                {syncingGithub ? "Syncing GitHub..." : "Test / Sync GitHub Repos"}
              </button>
            </div>

            {githubError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-inset-md py-inset-sm text-xs text-destructive">
                {githubError}
              </div>
            )}

            {githubSnapshot && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-inset-md space-y-stack-md">
                <div className="flex flex-wrap items-center justify-between gap-inline-sm">
                  <div className="text-xs font-medium text-foreground">
                    Synced {githubSnapshot.repos.length} public{" "}
                    {githubSnapshot.repos.length === 1 ? "repository" : "repositories"} for{" "}
                    <span className="font-mono">@{githubSnapshot.username}</span>
                    {githubSnapshot.profile?.name ? ` (${githubSnapshot.profile.name})` : ""}
                  </div>
                  <a
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline"
                    href={githubSnapshot.profileUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View on GitHub
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                {githubSnapshot.profile?.bio && (
                  <p className="text-[11px] text-muted-foreground">{githubSnapshot.profile.bio}</p>
                )}
                {githubSnapshot.repos.length > 0 && (
                  <ul className="grid gap-inline-sm sm:grid-cols-2">
                    {githubSnapshot.repos.slice(0, 8).map((repo) => (
                      <li
                        key={repo.name}
                        className="rounded border border-border/50 bg-background/70 px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-inline-sm">
                          <a
                            className="font-mono font-medium text-foreground hover:underline truncate"
                            href={repo.html_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {repo.name}
                          </a>
                          {repo.language && (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {repo.language}
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                            {repo.description}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* LinkedIn & Website */}
          <div className="grid gap-inline-lg sm:grid-cols-2">
            <div className="space-y-stack-xs">
              <label
                className="text-xs font-medium text-foreground"
                htmlFor="connector-linkedin-url"
              >
                LinkedIn URL
              </label>
              <input
                className="w-full rounded-lg border border-border bg-background px-inset-md py-inset-sm text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                id="connector-linkedin-url"
                placeholder="https://www.linkedin.com/in/your-handle"
                type="url"
                value={formState.linkedinUrl}
                onChange={(e) => updateField("linkedinUrl", e.target.value)}
              />
            </div>

            <div className="space-y-stack-xs">
              <label
                className="text-xs font-medium text-foreground"
                htmlFor="connector-website-url"
              >
                Personal Website / Portfolio URL
              </label>
              <input
                className="w-full rounded-lg border border-border bg-background px-inset-md py-inset-sm text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                id="connector-website-url"
                placeholder="https://yourdomain.com"
                type="url"
                value={formState.websiteUrl}
                onChange={(e) => updateField("websiteUrl", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-stack-xs">
            <label className="text-xs font-medium text-foreground" htmlFor="connector-x-handle">
              X / Additional Handle or Links
            </label>
            <input
              className="w-full rounded-lg border border-border bg-background px-inset-md py-inset-sm text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              id="connector-x-handle"
              placeholder="@handle or additional profile links"
              type="text"
              value={formState.xHandle}
              onChange={(e) => updateField("xHandle", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Personal Dossier Cards */}
      <section className="rounded-xl border border-border/70 bg-background p-inset-lg space-y-stack-2xl">
        <div className="space-y-stack-xs">
          <h3 className="text-sm font-semibold text-foreground">Personal Dossier</h3>
          <p className="text-xs text-muted-foreground">
            Ask AI to draft a section, then paste its full reply below.
          </p>
        </div>

        {DOSSIER_FIELDS.map(({ field }) => (
          <DossierFieldEditor
            key={field}
            field={field}
            value={formState[field]}
            onValueChange={(value) => updateField(field, value)}
          />
        ))}
      </section>
    </div>
  );
}

export default ConnectorsSettingsTab;
