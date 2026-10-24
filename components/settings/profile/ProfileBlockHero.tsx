"use client";

import type { ProfileBlockProps } from "./profile-block-types";

import { useEffect, useState } from "react";
import { User } from "lucide-react";

import { RoleBadges } from "./RoleBadges";

import { Avatar, AvatarFallback } from "@/components/third-party/ui/avatar";

export function ProfileBlockHero({
  profile,
  summary,
  tree,
  email,
  displayName,
  canEditTree,
  isSavingTree,
  onTreeFieldPatch,
}: ProfileBlockProps) {
  const [isEditingHeadline, setIsEditingHeadline] = useState(false);
  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const rawName = displayName || profile?.display_name || null;
  const name = rawName && !isEmail(rawName) ? rawName : null;
  const headline = tree?.headline ?? summary?.headline ?? null;
  const [headlineDraft, setHeadlineDraft] = useState(headline ?? "");
  const roles = tree?.roles;
  const displayEmail = profile?.email ?? email ?? null;

  useEffect(() => {
    setHeadlineDraft(headline ?? "");
  }, [headline]);

  const saveHeadline = async () => {
    const nextHeadline = headlineDraft.trim();

    if (!nextHeadline || nextHeadline === headline) {
      setIsEditingHeadline(false);

      return;
    }

    try {
      await onTreeFieldPatch?.({ headline: nextHeadline });
      setIsEditingHeadline(false);
    } catch {
      // ProfileView renders the save error and reverts optimistic state.
    }
  };

  const initials = name
    ? name
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  return (
    <div className="flex flex-col items-center gap-5 px-1 text-center sm:flex-row sm:items-start sm:gap-8 sm:text-left">
      {/* Avatar — solid, no card */}
      <Avatar className="h-16 w-16 shrink-0 rounded-2xl border border-border/50 bg-muted shadow-sm sm:h-20 sm:w-20">
        <AvatarFallback className="rounded-2xl text-lg font-semibold text-muted-foreground md:text-xl">
          {initials ?? <User className="size-7 md:size-8" />}
        </AvatarFallback>
      </Avatar>

      {/* Identity — directly on the page surface */}
      <div className="min-w-0 flex-1 space-y-4">
        <div>
          {name ? (
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {name}
            </h1>
          ) : (
            <p className="text-sm text-muted-foreground/50">Name not set</p>
          )}
          {displayEmail && (
            <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground/50">
              {displayEmail}
            </p>
          )}
        </div>

        {headline && (
          <div className="max-w-[50ch]">
            {isEditingHeadline ? (
              <div className="flex flex-col gap-2">
                <input
                  aria-label="Profile headline"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring md:text-[15px]"
                  disabled={isSavingTree}
                  maxLength={120}
                  value={headlineDraft}
                  onChange={(event) => setHeadlineDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveHeadline();
                    if (event.key === "Escape") {
                      setHeadlineDraft(headline);
                      setIsEditingHeadline(false);
                    }
                  }}
                />
                <div className="flex gap-2 text-[11px]">
                  <button
                    className="text-foreground underline decoration-foreground/30 disabled:text-muted-foreground"
                    disabled={isSavingTree}
                    type="button"
                    onClick={() => void saveHeadline()}
                  >
                    Save
                  </button>
                  <button
                    className="text-muted-foreground underline decoration-muted-foreground/30"
                    disabled={isSavingTree}
                    type="button"
                    onClick={() => {
                      setHeadlineDraft(headline);
                      setIsEditingHeadline(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="group/headline flex items-start gap-2">
                <p className="text-sm leading-snug text-foreground/60 md:text-[15px]">{headline}</p>
                {canEditTree && onTreeFieldPatch && (
                  <button
                    className="mt-0.5 text-[11px] text-muted-foreground opacity-0 underline decoration-muted-foreground/30 transition-opacity hover:text-foreground group-hover/headline:opacity-100 focus-visible:opacity-100"
                    type="button"
                    onClick={() => setIsEditingHeadline(true)}
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {roles?.length ? <RoleBadges roles={roles} /> : null}
      </div>
    </div>
  );
}
