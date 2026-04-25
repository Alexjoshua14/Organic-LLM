"use client";

import type { UIMessage } from "ai";
import type { Thread } from "@/lib/schemas/chat";
import type { StrataPageWithSections, StrataSourceComposerSettings } from "@/lib/schemas/strata";
import type { StrataPageAssistantSession } from "@/lib/strata/assistant-session";

import { useCallback, useMemo, useRef, useState } from "react";

import { StrataAssistantPanel } from "./StrataAssistantPanel";
import { StrataShell } from "./StrataShell";
import { StrataWorkspace } from "./StrataWorkspace";

import {
  getStrataAssistantPersona,
  type StrataAssistantPersonaId,
  type StrataAssistantToolDefaults,
} from "@/lib/personas/strata-assistant";
import { parseSourceComposerSettings } from "@/lib/strata/text-sources";

export function StrataPageClient({
  initialData,
  dbAvailable,
  pageAgentChatData,
}: {
  initialData: StrataPageWithSections;
  dbAvailable: boolean;
  pageAgentChatData: { thread: Thread; messages: UIMessage[] } | null;
}) {
  const initialSettings = useMemo(
    () =>
      parseSourceComposerSettings(
        initialData.sections.raw_text.contentJson as Record<string, unknown> | null
      ),
    [initialData.sections.raw_text.contentJson]
  );

  const defaultPersona: StrataAssistantPersonaId =
    initialSettings?.assistantPersonaId &&
    ["remy", "spark", "aion", "prometheus"].includes(initialSettings.assistantPersonaId)
      ? initialSettings.assistantPersonaId
      : "prometheus";

  const personaDef = getStrataAssistantPersona(defaultPersona);
  const defaultTools = personaDef.getDefaultToolDefaults();

  const [personaId, setPersonaIdState] = useState<StrataAssistantPersonaId>(defaultPersona);
  const [tools, setToolsState] = useState<StrataAssistantToolDefaults>({
    toolMemory: initialSettings?.toolMemory ?? defaultTools.toolMemory,
    toolWebSearch: initialSettings?.toolWebSearch ?? defaultTools.toolWebSearch,
    toolMessageSearch: initialSettings?.toolMessageSearch ?? defaultTools.toolMessageSearch,
    toolKnowledgeSearch: initialSettings?.toolKnowledgeSearch ?? defaultTools.toolKnowledgeSearch,
  });

  const persistComposerRef = useRef<(patch: Partial<StrataSourceComposerSettings>) => void>(
    () => {}
  );

  const registerComposerPersist = useCallback(
    (fn: (patch: Partial<StrataSourceComposerSettings>) => void) => {
      persistComposerRef.current = fn;
    },
    []
  );

  const setPersonaId = useCallback((id: StrataAssistantPersonaId) => {
    setPersonaIdState(id);
    const next = getStrataAssistantPersona(id).getDefaultToolDefaults();

    setToolsState((prev) => ({
      ...prev,
      ...next,
    }));
  }, []);

  const setTools = useCallback((patch: Partial<StrataAssistantToolDefaults>) => {
    setToolsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const assistantSession = useMemo<StrataPageAssistantSession>(
    () => ({
      personaId,
      setPersonaId,
      tools,
      setTools,
      persistComposerSettingsPatch: (patch) => {
        persistComposerRef.current(patch);
      },
    }),
    [personaId, setPersonaId, setTools, tools]
  );

  return (
    <StrataWorkspace
      agentPanel={
        <StrataAssistantPanel
          assistantSession={assistantSession}
          chatData={pageAgentChatData}
          emptyHint="Assistant needs a synced Strata page (not local-only / offline fallback). Turn off local-only for this page or fix connectivity, then refresh."
          experience="strata_page"
          strataPageId={initialData.page.id}
        />
      }
    >
      <StrataShell
        assistantSession={assistantSession}
        dbAvailable={dbAvailable}
        initialData={initialData}
        onRegisterComposerPersist={registerComposerPersist}
      />
    </StrataWorkspace>
  );
}
