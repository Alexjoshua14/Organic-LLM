import type { StrataSourceComposerSettings } from "@/lib/schemas/strata";
import type { StrataAssistantPersonaId, StrataAssistantToolDefaults } from "@/lib/personas/strata-assistant";

export type StrataPageAssistantSession = {
  personaId: StrataAssistantPersonaId;
  setPersonaId: (id: StrataAssistantPersonaId) => void;
  tools: StrataAssistantToolDefaults;
  setTools: (patch: Partial<StrataAssistantToolDefaults>) => void;
  persistComposerSettingsPatch: (patch: Partial<StrataSourceComposerSettings>) => void;
};
