"use client";

import type { Profile } from "@/lib/schemas/profiles";
import type { ProfileTree, ProfileTreeSource } from "@/lib/schemas/profileTree";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";

import { DEFAULT_PROFILE_LAYOUT, type ProfileBlockId } from "./profile-block-types";
import { PROFILE_BLOCK_REGISTRY } from "./profile-block-registry";

import { getTailoredDisplayName } from "@/config/tailored-profiles";
import {
  buildTailoredTree,
  getEmptyProfileTree,
  isTailoredTree,
  type ProfileTreeVariant,
} from "@/config/profile-trees";
import { ProfileTreeSchema } from "@/lib/schemas/profileTree";

type ProfileViewProps = {
  profile: Profile | null;
  /** Clerk email, used for tailored profile when profile.email isn't set yet */
  email?: string | null;
  /** Clerk full name, used when profile.display_name isn't set */
  displayName?: string | null;
};

export function ProfileView({ profile, email, displayName }: ProfileViewProps) {
  const [tree, setTree] = useState<ProfileTree | null>(null);
  const [treeSource, setTreeSource] = useState<ProfileTreeSource | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingTree, setSavingTree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedEmail = profile?.email ?? email ?? null;
  const tailoredName = useMemo(() => getTailoredDisplayName(resolvedEmail), [resolvedEmail]);
  const tailoredSeedTree = useMemo(
    () => (isTailoredTree(resolvedEmail) ? buildTailoredTree() : null),
    [resolvedEmail]
  );
  const emptyTree = useMemo(() => getEmptyProfileTree(), []);
  const renderedTree = tree ?? tailoredSeedTree ?? emptyTree;
  const treeVariant: ProfileTreeVariant = tree
    ? treeSource === "tailored-seed"
      ? "tailored"
      : "generated"
    : tailoredSeedTree
      ? "tailored"
      : "empty";

  useEffect(() => {
    let mounted = true;

    async function loadProfileTree() {
      setTreeLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/profile/tree");
        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(payload.error ?? "Failed to load profile tree");
        }

        const persisted = payload.data as {
          tree?: unknown;
          source?: ProfileTreeSource | null;
        } | null;

        if (!mounted) return;

        setTree(persisted?.tree ? ProfileTreeSchema.parse(persisted.tree) : null);
        setTreeSource(persisted?.source ?? null);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load profile tree");
      } finally {
        if (mounted) setTreeLoading(false);
      }
    }

    loadProfileTree();

    return () => {
      mounted = false;
    };
  }, []);

  const saveTailoredSeed = useCallback(async () => {
    if (!tailoredSeedTree) return;

    setSavingTree(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree: tailoredSeedTree }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to save profile");
      }

      setTree(ProfileTreeSchema.parse(payload.data));
      setTreeSource("tailored-seed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSavingTree(false);
    }
  }, [tailoredSeedTree]);

  const generateProfileTree = useCallback(async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profile?.display_name ?? displayName ?? "User",
          email: resolvedEmail ?? "",
        }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to generate profile");
      }

      setTree(ProfileTreeSchema.parse(payload.data));
      setTreeSource("llm-generated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }, [displayName, profile?.display_name, resolvedEmail]);

  const patchTreeFields = useCallback(
    async (fields: { headline?: string; signature?: string }) => {
      if (!tree) return;

      const previousTree = tree;
      const optimisticTree = ProfileTreeSchema.parse({ ...tree, ...fields });

      setTree(optimisticTree);
      setSavingTree(true);
      setError(null);

      try {
        const res = await fetch("/api/profile/tree", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(payload.error ?? "Failed to update profile");
        }

        setTree(ProfileTreeSchema.parse(payload.data));
        setTreeSource("user-edited");
      } catch (e) {
        setTree(previousTree);
        setError(e instanceof Error ? e.message : "Failed to update profile");
        throw e;
      } finally {
        setSavingTree(false);
      }
    },
    [tree]
  );

  if (treeLoading) {
    return <div className="h-64 rounded-2xl bg-muted/40 animate-pulse" />;
  }

  const blockProps = {
    profile,
    summary: null,
    tree: renderedTree,
    treeVariant,
    email: profile?.email ?? email ?? null,
    displayName: tailoredName || displayName || null,
    canEditTree: Boolean(tree),
    isSavingTree: savingTree,
    onTreeFieldPatch: patchTreeFields,
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
          {tree
            ? "Profile content is saved to your account and available across devices."
            : tailoredSeedTree
              ? "Tailored starter profile. Save it to your account, then edit headline and signature."
              : "Generate a profile tree to save it to your account across devices."}
        </p>
        <div className="flex flex-wrap gap-2">
          {tailoredSeedTree && !tree && (
            <Button
              isDisabled={savingTree}
              isLoading={savingTree}
              size="sm"
              variant="bordered"
              onPress={saveTailoredSeed}
            >
              Save tailored profile
            </Button>
          )}
          <Button
            isDisabled={generating || savingTree}
            isLoading={generating}
            size="sm"
            variant="bordered"
            onPress={generateProfileTree}
          >
            {tree ? "Regenerate profile tree" : "Generate profile tree"}
          </Button>
        </div>
      </div>
    </div>
  );
}
