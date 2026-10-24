"use client";

import type { ComponentProps } from "react";

import { ComposerActionButton } from "./composer-action-button";

/** Capabilities the composer grants the model for the next turn. */
export type ComposerToolId = "search" | "memory";

/**
 * Composer affordances that shape how a reply is written or how the draft is
 * displayed. These never reach the model as tools.
 */
export type ComposerPreferenceId = "speech" | "preview";

export type ComposerChipId = ComposerToolId | ComposerPreferenceId;

export type ComposerToolChipProps = ComponentProps<typeof ComposerActionButton> & {
  active: boolean;
  chip: ComposerChipId;
};

export function ComposerToolChip({ active, chip, ...props }: ComposerToolChipProps) {
  return <ComposerActionButton engaged={active} data-chip={chip} {...props} />;
}
