"use client";

import type { ProfileBlockProps } from "./profile-block-types";

import { SignatureBlock } from "./SignatureBlock";

export function ProfileBlockSignature({ tree }: ProfileBlockProps) {
  if (!tree?.signature?.trim()) return null;

  return <SignatureBlock signature={tree.signature} />;
}
