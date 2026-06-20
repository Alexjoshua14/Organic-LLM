"use client";

import type { ComponentProps } from "react";

import { ComposerActionButton } from "./composer-action-button";

export type ComposerToolId = "search" | "memory" | "speech" | "preview";

export type ComposerToolChipProps = ComponentProps<typeof ComposerActionButton> & {
  active: boolean;
  tool: ComposerToolId;
};

export function ComposerToolChip({ active, tool, ...props }: ComposerToolChipProps) {
  return <ComposerActionButton engaged={active} data-tool={tool} {...props} />;
}
