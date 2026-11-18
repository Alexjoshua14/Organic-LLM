"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, X } from "lucide-react";

import { LabPanel, PanelSection, SegmentedRow } from "../lab-panel";

import { EDITOR_FIXTURES } from "./editor-model";
import { RichComposer } from "./rich-composer";
import "./editor-prototype.css";

import {
  CoreInputControlsProvider,
  type CoreInputControlsValue,
  type InputMarkdownMode,
} from "@/components/chat/core-input/core-input-context";
import { ComposerActionButton } from "@/components/chat/composer-action-button";
import { ComposerAddFilesButton } from "@/components/chat/core-input/controls/add-files-button";
import {
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputProvider,
  usePromptInputController,
} from "@/components/third-party/ai-elements/prompt-input";
import { CoreInputOptions } from "@/components/chat/core-input/core-input-options";
import { resolveFooterPlacement } from "@/components/chat/core-input/footer/footer-placement";
import "@/components/chat/core-input/compact.css";
import { DEFAULT_COMPOSER_MODEL } from "@/lib/chat/composer-tool-defaults";
import { getSelectableChatModels } from "@/lib/schemas/chat";
import {
  CHAT_EFFORT_LEVELS,
  DEFAULT_CHAT_EFFORT,
  type ChatEffortLevel,
} from "@/lib/schemas/chat-effort";
import { DEFAULT_CONTEXT_EFFORT, type ContextEffortLevel } from "@/lib/memory/context-effort";
import { HomeComposerLumenShell } from "@/components/chat/home-composer-lumen-shell";
import { homeComposerGlassSurface } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

const SIMULATED_REPLY_MS = 1800;
const WIDTHS = [
  { value: "375", label: "Phone" },
  { value: "768", label: "Tablet" },
  { value: "1024", label: "Desktop" },
] as const;

const optionsPlacement = resolveFooterPlacement({
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

type SubmittedDraft = { markdown: string; model: string; memory: boolean; files: string[] };

/** The product's attachment state and `+` menu need a PromptInput provider above them. */
export default function EditorStage() {
  return (
    <PromptInputProvider>
      <EditorStageBody />
    </PromptInputProvider>
  );
}

function EditorStageBody() {
  const [width, setWidth] = useState("768");
  const [fixture, setFixture] = useState<keyof typeof EDITOR_FIXTURES>("empty");
  const [revision, setRevision] = useState(0);
  const [toolsContainer, setToolsContainer] = useState<HTMLDivElement | null>(null);
  const [model, setModel] = useState(DEFAULT_COMPOSER_MODEL);
  const [effort, setEffort] = useState<ChatEffortLevel>(DEFAULT_CHAT_EFFORT);
  const [webSearch, setWebSearch] = useState(true);
  const [speechFriendly, setSpeechFriendly] = useState(false);
  const [inputMode, setInputMode] = useState<InputMarkdownMode>("edit");
  const [contextEffort, setContextEffort] = useState<ContextEffortLevel>(DEFAULT_CONTEXT_EFFORT);
  const [memory, setMemory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedDraft | null>(null);
  const [status, setStatus] = useState("Local prototype. Nothing is sent to an AI.");
  const fileInput = useRef<HTMLInputElement>(null);
  const { attachments, __registerFileInput } = usePromptInputController();
  const files = useMemo(
    () => attachments.files.map((file) => file.filename ?? "file"),
    [attachments.files]
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The product's `+` menu opens the file dialog through the provider; point it at our input.
  useEffect(() => {
    __registerFileInput(fileInput, () => fileInput.current?.click());
  }, [__registerFileInput]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    setStatus("Stopped. Your draft is still in the editor.");
  }, []);
  const send = useCallback(
    (markdown: string) => {
      if (!markdown.trim()) return;
      setSubmitted({ markdown, model: model.name, memory, files: [...files] });
      setBusy(true);
      setStatus("Simulating a response…");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setBusy(false);
        setStatus("Simulation complete. Draft retained for comparison.");
      }, SIMULATED_REPLY_MS);
    },
    [model, memory, files]
  );

  const controls = useMemo<CoreInputControlsValue>(
    () => ({
      showLabels: true,
      useCondensedLayout: true,
      useWebSearch: webSearch,
      setUseWebSearch: setWebSearch,
      useMemories: memory,
      setUseMemories: setMemory,
      useSpeechFriendly: speechFriendly,
      setUseSpeechFriendly: setSpeechFriendly,
      inputMarkdownMode: inputMode,
      setInputMarkdownMode: setInputMode,
      model,
      selectableModels: getSelectableChatModels(false),
      onModelChange: (id) => {
        const next = getSelectableChatModels(false).find((entry) => entry.id === id);

        if (next) setModel(next);
      },
      effort,
      onEffortChange: (id) => {
        const next = CHAT_EFFORT_LEVELS.find((entry) => entry.id === id);

        if (next) setEffort(next.id);
      },
      showContextEffort: false,
      contextEffort,
      onContextEffortChange: setContextEffort,
    }),
    [webSearch, memory, speechFriendly, inputMode, model, effort, contextEffort]
  );

  return (
    <CoreInputControlsProvider value={controls}>
      <div className="core-editor-prototype grid min-w-0 gap-stack-2xl lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <section aria-label="Editor prototype stage" className="min-w-0">
          <div className="mb-stack-lg flex flex-wrap items-center justify-between gap-inline-sm text-xs text-muted-foreground">
            <span>Editor prototype</span>
            <span>Local only · no model calls or microphone</span>
          </div>
          <div className="mx-auto w-full min-w-0 py-inset-lg" style={{ maxWidth: Number(width) }}>
            <HomeComposerLumenShell className="editor-focus-lumen">
              <div
                data-prompt-input-shell
                className={cn(homeComposerGlassSurface, "editor-shell border border-border/60")}
              >
                <PromptInputAttachments>
                  {(attachment) => <PromptInputAttachment data={attachment} />}
                </PromptInputAttachments>
                <RichComposer
                  key={revision}
                  busy={busy}
                  toolsOpen={Boolean(toolsContainer)}
                  toolsContainer={toolsContainer}
                  leading={
                    <CoreInputOptions placement={optionsPlacement} ready={!busy && !voice} />
                  }
                  trailing={
                    <div className="flex gap-inline-sm">
                      <input
                        ref={fileInput}
                        aria-label="Attach prototype files"
                        className="hidden"
                        multiple
                        type="file"
                        onChange={(event) => {
                          if (event.target.files) attachments.add(event.target.files);
                          event.target.value = "";
                        }}
                      />
                      <ComposerAddFilesButton />
                      <ComposerActionButton
                        aria-label={voice ? "Return to draft" : "Simulate Speak live bar"}
                        aria-pressed={voice}
                        disabled={busy}
                        engaged={voice}
                        rimPulse={voice}
                        type="button"
                        onClick={() => setVoice((live) => !live)}
                      >
                        {voice ? (
                          <X aria-hidden className="size-4" />
                        ) : (
                          <Mic aria-hidden className="size-4" />
                        )}
                      </ComposerActionButton>
                    </div>
                  }
                  initialMarkdown={EDITOR_FIXTURES[fixture]}
                  voice={voice}
                  onSend={send}
                  onStop={stop}
                />
              </div>
            </HomeComposerLumenShell>
            <p
              aria-live="polite"
              className="mt-stack-sm px-inset-sm text-xs leading-relaxed text-muted-foreground"
            >
              {status}
            </p>
          </div>
          {submitted ? (
            <section
              aria-label="Last submitted Markdown"
              className="mt-stack-lg min-w-0 rounded-xl border border-border/60 p-inset-md"
            >
              <h2 className="text-sm font-medium">Last submitted Markdown</h2>
              <p className="mt-stack-xs text-xs text-muted-foreground">
                {submitted.model} · memory {submitted.memory ? "on" : "off"} ·{" "}
                {submitted.files.length} local attachment(s)
              </p>
              <pre className="mt-stack-md max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed">
                {submitted.markdown}
              </pre>
            </section>
          ) : null}
        </section>
        <aside className="lg:sticky lg:top-2">
          <LabPanel>
            <PanelSection title="Editing">
              <div ref={setToolsContainer} />
            </PanelSection>
            <PanelSection
              title="Viewport"
              hint="Presets cap the stage width; the actual screen can make it narrower."
            >
              <SegmentedRow
                label="Stage width"
                options={WIDTHS}
                value={width}
                onChange={setWidth}
              />
            </PanelSection>
            <PanelSection
              title="Draft fixtures"
              hint="Loading a fixture replaces the draft and resets editor history."
            >
              <div className="flex flex-wrap gap-inline-sm">
                {(Object.keys(EDITOR_FIXTURES) as Array<keyof typeof EDITOR_FIXTURES>).map(
                  (name) => (
                    <Button
                      key={name}
                      className="min-h-11 capitalize"
                      disabled={busy || voice}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFixture(name);
                        setRevision((value) => value + 1);
                      }}
                    >
                      {name}
                    </Button>
                  )
                )}
              </div>
            </PanelSection>
            <PanelSection title="Try it">
              <ul className="list-inside list-disc space-y-stack-sm text-xs leading-relaxed text-muted-foreground">
                <li>
                  Type /code, /list, /quote, or /heading. Use arrows and Enter, or tap a result.
                </li>
                <li>
                  Use the lab’s Editing controls to format or inspect Markdown source. Type ```ts
                  then Enter for a multiline code block.
                </li>
                <li>Open settings or change width while holding a selection.</li>
                <li>Use the mic button to simulate a live bar, then return to your draft.</li>
                <li>
                  Enter sends on desktop; Shift+Enter adds a line. Code blocks and touch keyboards
                  keep Enter for editing.
                </li>
              </ul>
            </PanelSection>
            <PanelSection title="Prototype boundaries">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tiptap Markdown is beta. Source is preserved until you edit the formatted document;
                subsequent serialization can normalize syntax. A source snapshot can be restored
                after switching modes. Tables, embedded HTML, and custom Markdown are outside this
                first prototype.
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Attachments stay in the browser and are never uploaded. Send, model selection,
                memory, and voice are simulations. No drafts are persisted.
              </p>
            </PanelSection>
          </LabPanel>
        </aside>
      </div>
    </CoreInputControlsProvider>
  );
}
