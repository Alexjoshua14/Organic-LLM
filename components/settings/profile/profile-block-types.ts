/**
 * Profile block types for the generative, hot-swappable profile view.
 * Add or reorder in DEFAULT_PROFILE_LAYOUT to change the profile page structure.
 * When using tree-based view, layout is ["hero", "tree"]; otherwise ["hero", "bio", "tags"].
 */

import type { ProfileSummary } from "@/lib/schemas/profileSummary";
import type { Profile } from "@/lib/schemas/profiles";
import type { ProfileTree } from "@/lib/schemas/profileTree";
import type { ProfileTreeVariant } from "@/config/profile-trees";

export type ProfileBlockId = "hero" | "bio" | "tags" | "signature" | "tree";

export type ProfileBlockProps = {
  profile: Profile | null;
  summary: ProfileSummary | null;
  /** Set when using tiered tree view (tailored / demo / generated / empty). */
  tree?: ProfileTree | null;
  treeVariant?: ProfileTreeVariant;
  /** Clerk email (fallback when profile.email isn't set). */
  email?: string | null;
  /** Clerk full name (fallback when profile.display_name isn't set). */
  displayName?: string | null;
};

/** Tree-based layout: hero + optional signature + tiered sections. */
export const DEFAULT_PROFILE_LAYOUT: ProfileBlockId[] = [
  "hero",
  "signature",
  "tree",
];
