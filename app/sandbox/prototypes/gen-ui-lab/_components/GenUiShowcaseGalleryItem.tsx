"use client";

import type { GenUIBlock } from "@/lib/schemas/gen-ui";
import type { GenUiShowcaseType } from "@/lib/sandbox/gen-ui-lab-showcases";

import {
  GenUiBlockShowcasePreview,
  GenUiBlockShowcaseToolbar,
  useGenUiBlockShowcase,
} from "./GenUiBlockShowcase";
import { GenUiArchetypeViewTabs } from "./GenUiArchetypeViewTabs";
import { GenUiArrangementPauseZone } from "./GenUiArrangementToolbar";
import { GenUiCondensedBlock } from "./GenUiCondensedPreviews";
import { GenUiGallerySection } from "./GenUiGallerySection";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";

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
  const fullPreview = <GenUiBlockShowcasePreview showcase={showcase} messageId={`lab-${type}`} />;
  const condensedPreview = (
    <GenUiArrangementPauseZone cycle={showcase.cycle}>
      <GenUiCondensedBlock block={showcase.block}>
        <GenUIRenderer data={{ block: showcase.block }} messageId={`lab-${type}`} />
      </GenUiCondensedBlock>
    </GenUiArrangementPauseZone>
  );

  return (
    <GenUiGallerySection
      active={active}
      archetype={type}
      header={<GenUiBlockShowcaseToolbar showcase={showcase} />}
      registerRef={registerRef}
    >
      <GenUiArchetypeViewTabs archetype={type} condensedPreview={condensedPreview}>
        {fullPreview}
      </GenUiArchetypeViewTabs>
    </GenUiGallerySection>
  );
}
