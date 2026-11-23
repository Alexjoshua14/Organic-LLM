"use client";

import { useState } from "react";

import { GenUiArchetypeViewTabs } from "./GenUiArchetypeViewTabs";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { ChoicePicker } from "@/components/design-system/choice-picker";
import { COMPOSITION_EXAMPLES } from "@/lib/schemas/gen-ui/composition-fixtures";

export const LAB_COMPOSITION_ARCHETYPE = "composition";
export const LAB_COMPOSITION_LABEL = "Read-only compositions";

const examples = [
  { label: "Population share", value: "population" },
  { label: "Release readiness", value: "release" },
];

export function GenUiCompositionDemo() {
  const [example, setExample] = useState<keyof typeof COMPOSITION_EXAMPLES>("population");

  const block = COMPOSITION_EXAMPLES[example];

  return (
    <div className="space-y-stack-md">
      <ChoicePicker
        label="Composition example"
        value={example}
        options={examples}
        onValueChange={(value) => setExample(value === "release" ? "release" : "population")}
      />
      <GenUiArchetypeViewTabs
        archetype={LAB_COMPOSITION_ARCHETYPE}
        condensedPreview={
          <GenUIRenderer key={example} data={{ block }} compositionDensity="condensed" />
        }
      >
        <GenUIRenderer key={example} data={{ block }} compositionDensity="full" />
      </GenUiArchetypeViewTabs>
    </div>
  );
}
