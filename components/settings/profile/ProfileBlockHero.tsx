"use client";

import { Avatar, AvatarFallback } from "@/components/third-party/ui/avatar";
import type { ProfileBlockProps } from "./profile-block-types";
import { RoleBadges } from "./RoleBadges";

export function ProfileBlockHero({ profile, summary, tree }: ProfileBlockProps) {
  const name = profile?.display_name ?? "User";
  const headline = tree?.headline ?? summary?.headline ?? "Member";
  const roles = tree?.roles;

  return (
    <div className="flex flex-col items-center gap-5 text-center md:gap-6">
      <Avatar className="h-24 w-24 rounded-full border-2 border-border bg-muted shadow-md md:h-28 md:w-28">
        <AvatarFallback className="text-2xl font-semibold text-muted-foreground md:text-3xl">
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2 md:space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {name}
        </h1>
        <p className="text-sm leading-snug text-muted-foreground md:text-base">
          {headline}
        </p>
        {roles?.length ? (
          <div className="pt-1">
            <RoleBadges roles={roles} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
