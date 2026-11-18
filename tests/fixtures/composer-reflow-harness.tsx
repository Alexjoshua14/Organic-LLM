import type { Editor } from "@tiptap/core";
import type { CoreInputControlsValue } from "@/components/chat/core-input/core-input-context";

import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  COMPACT_ROW_BAND,
  COMPACT_ROW_LINE,
  COMPACT_SUBMIT_CLASS,
  composerDraftClassName,
} from "@/components/chat/core-input/compact-row";
import { CoreInputControlsProvider } from "@/components/chat/core-input/core-input-context";
import { CoreInputOptions } from "@/components/chat/core-input/core-input-options";
import { ComposerAddFilesButton } from "@/components/chat/core-input/controls/add-files-button";
import { ComposerMicButton } from "@/components/chat/core-input/controls/mic-button";
import {
  ComposerEditor,
  focusDraftFromShell,
} from "@/components/chat/core-input/editor/composer-editor";
import { useContainedScroll } from "@/components/chat/core-input/editor/contained-scroll";
import { LumenSubmit } from "@/components/chat/core-input/editor/lumen-submit";
import { useComposerReflow } from "@/components/chat/core-input/editor/use-composer-reflow";
import { resolveFooterPlacement } from "@/components/chat/core-input/footer/footer-placement";
import { PromptInputProvider } from "@/components/third-party/ai-elements/prompt-input";
import { DEFAULT_COMPOSER_MODEL } from "@/lib/chat/composer-tool-defaults";
import { DEFAULT_CONTEXT_EFFORT } from "@/lib/memory/context-effort";
import { getSelectableChatModels } from "@/lib/schemas/chat";
import { DEFAULT_CHAT_EFFORT } from "@/lib/schemas/chat-effort";
import { cn } from "@/lib/utils";

const placement = resolveFooterPlacement({
  condensed: true,
  compact: false,
  personaEnabled: false,
  hideWebMemorySpeechToggles: false,
  hasSpeechFriendly: true,
  hasMarkdownPreview: false,
  previewingMarkdown: false,
  hasSteer: false,
  showContextEffort: false,
  hasAttachments: true,
});

/**
 * Compact CoreInput's row, built from the same parts and classes as `core-input.tsx`: the real
 * editor, reflow logic, settings control and buttons, inside the same root, panel slot and shell
 * markers, without the app around it. The spec sizes the page, types into it, reads
 * `data-expanded`, counts layout changes, measures buttons and opens the settings panel.
 */
function ReflowHarness() {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [text, setText] = useState("");
  useContainedScroll(rootRef);
  const stacked = useComposerReflow(rowRef, editor, { enabled: true, forced: false });
  const controls = useMemo<CoreInputControlsValue>(
    () => ({
      showLabels: false,
      useCondensedLayout: true,
      useWebSearch: true,
      setUseWebSearch: () => {},
      useMemories: true,
      setUseMemories: () => {},
      useSpeechFriendly: false,
      setUseSpeechFriendly: () => {},
      inputMarkdownMode: "edit",
      setInputMarkdownMode: () => {},
      model: DEFAULT_COMPOSER_MODEL,
      selectableModels: getSelectableChatModels(false),
      onModelChange: () => {},
      effort: DEFAULT_CHAT_EFFORT,
      onEffortChange: () => {},
      showContextEffort: false,
      contextEffort: DEFAULT_CONTEXT_EFFORT,
      onContextEffortChange: () => {},
    }),
    []
  );

  return (
    <CoreInputControlsProvider value={controls}>
      <div ref={rootRef} className="relative z-40 w-full min-w-0" data-core-input-root="">
        <div className="contents" data-core-input-panel-slot="" />
        <form
          className="core-input-condensed relative z-10 w-full"
          onClick={(event) => focusDraftFromShell(event.target, editor)}
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="rounded-2xl border border-border" data-prompt-input-shell="">
            <div
              ref={rowRef}
              className="core-input-compact-row"
              data-expanded={stacked ? "true" : "false"}
              data-row
            >
              <div className={cn(COMPACT_ROW_BAND, "core-input-reflow-lead")} data-reflow="lead">
                <CoreInputOptions placement={placement} ready />
              </div>
              <div
                className={cn("core-input-reflow-area", !stacked && COMPACT_ROW_LINE)}
                data-reflow="area"
              >
                <ComposerEditor
                  // As CoreInput does, with the context budget on (its default).
                  className={composerDraftClassName({
                    condensed: true,
                    reserveBudget: Boolean(text.trim()),
                  })}
                  commands={[{ kind: "app", id: "btw", label: "By the way", hint: "Ask aside" }]}
                  textareaRef={textareaRef}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onEditor={setEditor}
                />
              </div>
              <div className={cn(COMPACT_ROW_BAND, "core-input-reflow-trail")} data-reflow="trail">
                <ComposerAddFilesButton />
                <ComposerMicButton textareaRef={textareaRef} onTranscriptionChange={setText} />
              </div>
              <div className={cn(COMPACT_ROW_BAND, "core-input-reflow-send")} data-reflow="send">
                <LumenSubmit className={COMPACT_SUBMIT_CLASS} disabled={!text} status="ready" />
              </div>
            </div>
          </div>
        </form>
      </div>
    </CoreInputControlsProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <PromptInputProvider>
    <ReflowHarness />
  </PromptInputProvider>
);
