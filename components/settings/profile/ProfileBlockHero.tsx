"use client";

import type { ProfileBlockProps } from "./profile-block-types";

import { User } from "lucide-react";

import { RoleBadges } from "./RoleBadges";

import { Avatar, AvatarFallback } from "@/components/third-party/ui/avatar";

export function ProfileBlockHero({
  profile,
  summary,
  tree,
  email,
  displayName,
}: ProfileBlockProps) {
  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const rawName = displayName || profile?.display_name || null;
  const name = rawName && !isEmail(rawName) ? rawName : null;
  const headline = tree?.headline ?? summary?.headline ?? null;
  const roles = tree?.roles;
  const displayEmail = profile?.email ?? null;

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
          <p className="max-w-[50ch] text-sm leading-snug text-foreground/60 md:text-[15px]">
            {headline}
          </p>
        )}

        {roles?.length ? <RoleBadges roles={roles} /> : null}
      </div>
    </div>
  );
}
