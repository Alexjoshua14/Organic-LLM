"use client";

import type { ComponentType } from "react";
import type { ProfileBlockId } from "./profile-block-types";
import type { ProfileBlockProps } from "./profile-block-types";
import { ProfileBlockHero } from "./ProfileBlockHero";
import { ProfileBlockBio } from "./ProfileBlockBio";
import { ProfileBlockTags } from "./ProfileBlockTags";
import { ProfileBlockSignature } from "./ProfileBlockSignature";
import { ProfileBlockTree } from "./ProfileBlockTree";

export const PROFILE_BLOCK_REGISTRY: Record<
  ProfileBlockId,
  ComponentType<ProfileBlockProps>
> = {
  hero: ProfileBlockHero,
  bio: ProfileBlockBio,
  tags: ProfileBlockTags,
  signature: ProfileBlockSignature,
  tree: ProfileBlockTree,
};
