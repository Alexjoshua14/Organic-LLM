"use client";

import type { OpenInChatProvider } from "@/lib/export/prompts";

import { OpenInChat } from "@/components/design-system/OpenInChat";
import {
  DOSSIER_PROMPTS,
  getDossierPrompt,
  type DossierField,
} from "@/lib/connectors/dossier-prompts";

const DOSSIER_AI_PROVIDERS: OpenInChatProvider[] = ["chatgpt", "claude", "gemini"];

export function DossierAiAction({ field }: { field: DossierField }) {
  return (
    <div className="max-w-full space-y-stack-xs">
      <OpenInChat
        presetId={`dossier-${field}`}
        providers={DOSSIER_AI_PROVIDERS}
        query={getDossierPrompt(field)}
        triggerAriaLabel={`Ask AI for ${DOSSIER_PROMPTS[field].label}`}
        triggerClassName="min-h-11 gap-inline-sm border-border bg-background px-inset-sm py-inset-sm text-xs font-medium normal-case tracking-normal text-muted-foreground hover:text-foreground"
        triggerLabel="Ask AI"
      />
    </div>
  );
}
