"use client";

import type { StrataPageWithSections } from "@/lib/schemas/strata";

import { StrataShellBottomChrome } from "./strata-shell/StrataShellBottomChrome";
import { StrataShellHeader } from "./strata-shell/StrataShellHeader";
import { StrataShellStatusFooter } from "./strata-shell/StrataShellStatusFooter";
import { StrataSettingsTab } from "./strata-shell/StrataSettingsTab";
import { StrataSourceTab } from "./strata-shell/StrataSourceTab";
import { StrataSynthesisTab } from "./strata-shell/StrataSynthesisTab";
import { useStrataShellController } from "./strata-shell/useStrataShellController";

export function StrataShell({
  initialData,
  dbAvailable,
}: {
  initialData: StrataPageWithSections;
  dbAvailable: boolean;
}) {
  const shell = useStrataShellController(initialData, dbAvailable);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <StrataShellHeader
        activeTab={shell.activeTab}
        dbAvailable={shell.dbAvailable}
        localOnlyMode={shell.localOnlyMode}
        sourceSaveLabel={shell.sourceSaveLabel}
        sourceSaveState={shell.sourceSave.state}
        title={shell.pageData.title}
      />

      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div
          ref={shell.refs.scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        >
          <div className="mx-auto w-full max-w-5xl px-6 pb-32 pt-1">
            {shell.activeTab === "source" ? (
              <StrataSourceTab
                flushSaveRaw={shell.flushSaveRaw}
                queueRawAutosave={shell.queueRawAutosave}
                rawSubtitle={shell.labels.raw_text.subtitle}
                reduceMotion={shell.reduceMotion}
                refinedSectionTitle={shell.refinedSectionTitle}
                sections={shell.sections}
                setSections={shell.setSections}
                setSourceDocLayout={shell.setSourceDocLayout}
                sourceDocLayout={shell.sourceDocLayout}
              />
            ) : null}

            {shell.activeTab === "synthesis" ? (
              <StrataSynthesisTab
                elaboratedRef={shell.refs.elaboratedRef}
                isGenerating={shell.isGenerating}
                onPersistElaboratedJson={shell.persistElaboratedContentJson}
                sections={shell.sections}
              />
            ) : null}

            {shell.activeTab === "settings" ? (
              <StrataSettingsTab
                dbAvailable={shell.dbAvailable}
                labels={shell.labels}
                localOnlyMode={shell.localOnlyMode}
                onLocalOnlyChange={shell.applyLocalOnlyMode}
                onSaveSection={shell.saveSection}
                sections={shell.sections}
                setSections={shell.setSections}
              />
            ) : null}
          </div>
        </div>

        <StrataShellBottomChrome
          activeTab={shell.activeTab}
          isGenerating={shell.isGenerating}
          mode={shell.mode}
          onGenerate={shell.runGenerate}
          overwriteElaborated={shell.overwriteElaborated}
          setActiveTab={shell.setActiveTab}
          setOverwriteElaborated={shell.setOverwriteElaborated}
          showGenerationStrip={shell.showGenerationStrip}
          tabDefs={shell.tabDefs}
        />
      </div>

      <StrataShellStatusFooter
        actionStatus={shell.actionStatus}
        onDismissStatus={() => shell.setActionStatus({ state: "idle", text: "" })}
        showThinking={
          shell.actionStatus.state === "loading" || shell.isPending || shell.isGenerating
        }
      />
    </div>
  );
}
