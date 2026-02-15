"use client";

import type { ProfileBlockProps } from "./profile-block-types";
import { ProfileTreeView } from "./ProfileTreeView";

export function ProfileBlockTree({ tree, treeVariant }: ProfileBlockProps) {
  if (!tree) return null;
  return (
    <ProfileTreeView
      tree={tree}
      isPlaceholder={treeVariant === "empty"}
    />
  );
}
