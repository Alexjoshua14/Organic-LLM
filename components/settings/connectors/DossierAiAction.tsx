"use client";

import type { OpenInChatProvider } from "@/lib/export/prompts";

import { Sparkles } from "lucide-react";

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
        triggerClassName="h-7 gap-inline-sm px-inset-sm py-0 text-xs font-medium text-muted-foreground hover:text-foreground"
        triggerIcon={<Sparkles aria-hidden="true" className="size-3.5" />}
        triggerVariant="ghost"
        triggerLabel="Ask AI"
      />
    </div>
  );
}
