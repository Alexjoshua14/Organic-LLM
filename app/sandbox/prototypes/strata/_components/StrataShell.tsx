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

  const showThinking =
    shell.actionStatus.state === "loading" || shell.isPending || shell.isGenerating;

  const statusFooterProps = {
    actionStatus: shell.actionStatus,
    onDismissStatus: () => shell.setActionStatus({ state: "idle", text: "" }),
    showThinking,
  } as const;

  const statusFooterInline = <StrataShellStatusFooter {...statusFooterProps} variant="inline" />;
  const statusFooterBlock = <StrataShellStatusFooter {...statusFooterProps} variant="block" />;

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
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="mx-auto flex w-full max-w-5xl flex-1 min-h-0 flex-col px-6 pb-14 pt-1">
            {shell.activeTab === "source" ? (
              <StrataSourceTab
                flushSaveRaw={shell.flushSaveRaw}
                queueRawAutosave={shell.queueRawAutosave}
                reduceMotion={shell.reduceMotion}
                refinedSectionTitle={shell.refinedSectionTitle}
                sections={shell.sections}
                setSections={shell.setSections}
                setSourceDocLayout={shell.setSourceDocLayout}
                sourceDocLayout={shell.sourceDocLayout}
                statusRow={statusFooterInline}
              />
            ) : null}

            {shell.activeTab === "synthesis" ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                {statusFooterBlock}
                <div className="flex min-h-0 flex-1 flex-col">
                  <StrataSynthesisTab
                    elaboratedRef={shell.refs.elaboratedRef}
                    isGenerating={shell.isGenerating}
                    onPersistElaboratedJson={shell.persistElaboratedContentJson}
                    sections={shell.sections}
                  />
                </div>
              </div>
            ) : null}

            {shell.activeTab === "settings" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-2 pr-3 sm:pr-4">
                {statusFooterBlock}
                <StrataSettingsTab
                  dbAvailable={shell.dbAvailable}
                  labels={shell.labels}
                  localOnlyMode={shell.localOnlyMode}
                  onLocalOnlyChange={shell.applyLocalOnlyMode}
                  onSaveSection={shell.saveSection}
                  sections={shell.sections}
                  setSections={shell.setSections}
                />
              </div>
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
    </div>
  );
}
