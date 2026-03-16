"use client";

import type { Profile } from "@/lib/schemas/profiles";
import type { ProfileSummary } from "@/lib/schemas/profileSummary";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";

import { DEFAULT_PROFILE_LAYOUT, type ProfileBlockId } from "./profile-block-types";
import { PROFILE_BLOCK_REGISTRY } from "./profile-block-registry";

import { getProfileSummary, setProfileSummary } from "@/lib/profile-summary";
import { getTailoredProfileSummary, getTailoredDisplayName } from "@/config/tailored-profiles";
import { getProfileTree } from "@/config/profile-trees";

type ProfileViewProps = {
  profile: Profile | null;
  /** Clerk email, used for tailored profile when profile.email isn't set yet */
  email?: string | null;
  /** Clerk full name, used when profile.display_name isn't set */
  displayName?: string | null;
};

export function ProfileView({ profile, email, displayName }: ProfileViewProps) {
  const [summary, setSummary] = useState<ProfileSummary | null>(() => getProfileSummary());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedEmail = profile?.email ?? email ?? null;

  const tailoredSummary = useMemo(() => getTailoredProfileSummary(resolvedEmail), [resolvedEmail]);

  const tailoredName = useMemo(() => getTailoredDisplayName(resolvedEmail), [resolvedEmail]);

  const displaySummary = tailoredSummary ?? summary;

  const { tree, variant: treeVariant } = useMemo(
    () => getProfileTree(profile?.email ?? email ?? null, displaySummary),
    [profile?.email, email, displaySummary]
  );

  const generateSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profile?.display_name ?? "User",
          email: profile?.email ?? "",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        throw new Error(data.error ?? "Failed to generate");
      }
      const data = await res.json();

      setProfileSummary(data);
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [profile?.display_name, profile?.email]);

  useEffect(() => {
    const cached = getProfileSummary();

    if (cached) setSummary(cached);
  }, []);

  const blockProps = {
    profile,
    summary: displaySummary,
    tree,
    treeVariant,
    email: profile?.email ?? email ?? null,
    displayName: tailoredName || displayName || null,
  };
  const layout = DEFAULT_PROFILE_LAYOUT;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-14">
      <div className="flex flex-col gap-10">
        {layout.map((blockId: ProfileBlockId) => {
          const Block = PROFILE_BLOCK_REGISTRY[blockId];

          if (!Block) return null;

          return <Block key={blockId} {...blockProps} />;
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {treeVariant === "tailored"
            ? "Tailored profile. You can still regenerate an AI summary below."
            : treeVariant === "demo"
              ? "Demo profile. Sign in with your account to see your own or generate one."
              : treeVariant === "generated"
                ? "Profile copy is generated and cached locally. Regenerate to refresh."
                : "Generate a summary below or add your own; the LLM can tier it into sections."}
        </p>
        <Button isDisabled={loading} size="sm" variant="bordered" onPress={generateSummary}>
          {loading
            ? "Generating…"
            : summary
              ? "Regenerate profile summary"
              : "Generate profile summary"}
        </Button>
      </div>
    </div>
  );
}
