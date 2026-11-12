"use client";

import type { ReactNode } from "react";

import {
  useGenUiLanguageRotation,
  type GenUiLanguageRotation,
} from "../_hooks/use-gen-ui-language-rotation";

import { GenUiArrangementPauseZone } from "./GenUiArrangementToolbar";
import { GenUiLanguageControls } from "./GenUiLanguageControls";
import {
  buildLanguageDiffBlock,
  LAB_LANGUAGE_IDS,
  LAB_LANGUAGES,
  sampleFor,
} from "./lab-languages";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";

/** The code diff page opens on its own fixture; picking or shuffling a language replaces it. */
export function useGenUiCodeDiffDemo(active = true) {
  return useGenUiLanguageRotation(LAB_LANGUAGE_IDS, null, active);
}

export function GenUiCodeDiffDemoToolbar({ rotation }: { rotation: GenUiLanguageRotation }) {
  return (
    <div className="shrink-0 border-b border-border/40 pb-stack-md">
      <GenUiLanguageControls
        defaultLabel="Default fixture"
        languages={LAB_LANGUAGES}
        rotation={rotation}
      />
    </div>
  );
}

/** `children` is the page's normal content, shown until a language is chosen. */
export function GenUiCodeDiffDemo({
  rotation,
  children,
}: {
  rotation: GenUiLanguageRotation;
  children: ReactNode;
}) {
  const sample = rotation.language ? sampleFor(rotation.language) : null;

  return (
    <GenUiArrangementPauseZone cycle={rotation}>
      {sample ? (
        // Keyed by language so each step remounts, as a new message would.
        <GenUIRenderer
          key={sample.id}
          data={{ block: buildLanguageDiffBlock(sample) }}
          messageId={`lab-code-diff-${sample.id}`}
        />
      ) : (
        children
      )}
    </GenUiArrangementPauseZone>
  );
}
