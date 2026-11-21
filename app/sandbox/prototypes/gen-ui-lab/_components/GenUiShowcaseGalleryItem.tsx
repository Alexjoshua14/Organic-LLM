"use client";

import type { GenUIBlock } from "@/lib/schemas/gen-ui";
import type { GenUiShowcaseType } from "@/lib/sandbox/gen-ui-lab-showcases";

import {
  GenUiBlockShowcasePreview,
  GenUiBlockShowcaseToolbar,
  useGenUiBlockShowcase,
} from "./GenUiBlockShowcase";
import { GenUiArchetypeViewTabs } from "./GenUiArchetypeViewTabs";
import { GenUiGallerySection } from "./GenUiGallerySection";

type GenUiShowcaseGalleryItemProps = {
  type: GenUiShowcaseType;
  liveBlock: GenUIBlock;
  active: boolean;
  registerRef: (node: HTMLElement | null) => void;
};

/**
 * One gallery snap page with a Component-states toolbar (when the archetype has more than
 * one preset). Owns its arrangement cycle so the shell does not call hooks in a loop.
 */
export function GenUiShowcaseGalleryItem({
  type,
  liveBlock,
  active,
  registerRef,
}: GenUiShowcaseGalleryItemProps) {
  const showcase = useGenUiBlockShowcase(type, liveBlock, active);

  return (
    <GenUiGallerySection
      active={active}
      archetype={type}
      header={<GenUiBlockShowcaseToolbar showcase={showcase} />}
      registerRef={registerRef}
    >
      <GenUiArchetypeViewTabs archetype={type}>
        <GenUiBlockShowcasePreview showcase={showcase} messageId={`lab-${type}`} />
      </GenUiArchetypeViewTabs>
    </GenUiGallerySection>
  );
}
