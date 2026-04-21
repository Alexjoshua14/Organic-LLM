"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import type { StrataPageAssistantSession } from "@/lib/strata/assistant-session";

import { glass } from "@/components/design-system/primitives";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/third-party/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { cn } from "@/lib/utils";
import {
  buildStrataAssistantPersonaInspectorSnapshot,
  getStrataAssistantPersona,
  listStrataAssistantPersonas,
  type StrataAssistantPersonaId,
  type StrataAssistantPersonaInspectorSnapshot,
  type StrataAssistantToolDefaults,
} from "@/lib/personas/strata-assistant";

/** Escape `|` so GFM table cells stay single-column. */
function mdTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Fence length strictly longer than any run of backticks in `body`. */
function fencedCodeBlock(body: string, lang: "json" | "text"): string {
  let maxRun = 0;
  let run = 0;
  for (const ch of body) {
    if (ch === "`") {
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 0;
    }
  }
  const tick = "`".repeat(Math.max(3, maxRun + 1));
  return `${tick}${lang}\n${body}\n${tick}`;
}

function blockquoteMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line.replace(/^(\s*)>/gm, "$1\\>")}`)
    .join("\n");
}

function buildPersonaInspectorMarkdown(s: StrataAssistantPersonaInspectorSnapshot): string {
  const t = s.defaultToolDefaults;
  const tableRows = [
    `| Field | Value |`,
    `| --- | --- |`,
    `| **Persona id** | \`${mdTableCell(s.id)}\` |`,
    `| **Short label** | ${mdTableCell(s.shortLabel)} |`,
    `| **Default model (name)** | ${mdTableCell(s.defaultModel.name)} |`,
    `| **Default model id** | \`${mdTableCell(s.defaultModel.id)}\` |`,
    `| **Tool: memory** | ${t.toolMemory ? "on" : "off"} |`,
    `| **Tool: web search** | ${t.toolWebSearch ? "on" : "off"} |`,
    `| **Tool: message search** | ${t.toolMessageSearch ? "on" : "off"} |`,
    `| **Tool: knowledge (stub)** | ${t.toolKnowledgeSearch ? "on" : "off"} |`,
  ].join("\n");

  return [
    "## System prompt augmentation",
    "",
    "Merged on the server after the base chat system prompt and Strata page grounding.",
    "",
    fencedCodeBlock(s.systemPromptAugmentation, "text"),
    "",
    "## Model and tool defaults",
    "",
    "Structured view of the same fields embedded in the JSON block below.",
    "",
    tableRows,
    "",
    "## Routing",
    "",
    "How this persona is wired into the Strata page assistant request.",
    "",
    blockquoteMarkdown(s.routingNote),
    "",
    "## Machine-readable JSON",
    "",
    "Full snapshot (includes augmentation again) for copy/paste or diffing.",
    "",
    fencedCodeBlock(JSON.stringify(s, null, 2), "json"),
    "",
  ].join("\n");
}

function AssistantToolSegmentedPill({
  tools,
  onToggle,
}: {
  tools: StrataAssistantToolDefaults;
  onToggle: (key: keyof StrataAssistantToolDefaults) => void;
}) {
  const segments: {
    key: keyof StrataAssistantToolDefaults;
    label: string;
    title?: string;
  }[] = [
    { key: "toolMemory", label: "Memory" },
    { key: "toolWebSearch", label: "Web" },
    { key: "toolMessageSearch", label: "Msgs", title: "Search this chat’s history" },
    {
      key: "toolKnowledgeSearch",
      label: "Know",
      title: "Knowledge graph tools (stubbed persistence)",
    },
  ];

  return (
    <div
      role="group"
      aria-label="Assistant tools"
      className={cn(
        glass(),
        "flex min-h-[2.5rem] w-full max-w-full flex-row overflow-hidden rounded-full border border-border/60"
      )}
    >
      {segments.map((seg, i) => {
        const on = tools[seg.key];
        return (
          <Fragment key={seg.key}>
            {i > 0 ? (
              <div
                aria-hidden
                className="w-px shrink-0 self-stretch bg-border/60 dark:bg-border/50"
              />
            ) : null}
            <button
              type="button"
              title={seg.title}
              aria-pressed={on}
              className={cn(
                "min-w-0 flex-1 px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors sm:px-2.5 sm:text-[11px]",
                "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                on
                  ? cn(glass({ opaque: true, border: "none" }), "text-foreground")
                  : "border-0 bg-transparent text-muted-foreground backdrop-blur-sm hover:bg-muted/35 hover:text-foreground"
              )}
              onClick={() => onToggle(seg.key)}
            >
              <span className="truncate">{seg.label}</span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

export function StrataSourceComposerOptions({
  assistantSession,
}: {
  assistantSession: StrataPageAssistantSession;
}) {
  const personas = listStrataAssistantPersonas();
  const [inspectorPersonaId, setInspectorPersonaId] = useState<StrataAssistantPersonaId | null>(null);

  const inspectorSnapshot = useMemo(
    () =>
      inspectorPersonaId ? buildStrataAssistantPersonaInspectorSnapshot(inspectorPersonaId) : null,
    [inspectorPersonaId]
  );

  const inspectorMarkdown = useMemo(
    () => (inspectorSnapshot ? buildPersonaInspectorMarkdown(inspectorSnapshot) : ""),
    [inspectorSnapshot]
  );

  const persistPersona = (id: StrataAssistantPersonaId) => {
    assistantSession.setPersonaId(id);
    const defaults = getStrataAssistantPersona(id).getDefaultToolDefaults();
    assistantSession.persistComposerSettingsPatch({
      assistantPersonaId: id,
      toolMemory: defaults.toolMemory,
      toolWebSearch: defaults.toolWebSearch,
      toolMessageSearch: defaults.toolMessageSearch,
      toolKnowledgeSearch: defaults.toolKnowledgeSearch,
    });
  };

  const persistTools = (patch: Partial<typeof assistantSession.tools>) => {
    assistantSession.setTools(patch);
    assistantSession.persistComposerSettingsPatch(patch);
  };

  const toggleTool = (key: keyof StrataAssistantToolDefaults) => {
    persistTools({ [key]: !assistantSession.tools[key] });
  };

  const copyInspectorJson = async () => {
    if (!inspectorSnapshot) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(inspectorSnapshot, null, 2));
      toast.success("Copied persona inspection JSON");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className={cn(glass({ opaque: true }), "space-y-3 rounded-xl border border-border/60 p-4")}>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assistant persona
        </p>
        <div className="flex flex-wrap gap-2">
          {personas.map((p) => (
            <ContextMenu key={p.id}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    assistantSession.personaId === p.id
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => persistPersona(p.id)}
                >
                  {p.shortLabel}
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-[11rem]">
                <ContextMenuItem onSelect={() => setInspectorPersonaId(p.id)}>
                  Inspect persona…
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    void (async () => {
                      try {
                        await navigator.clipboard.writeText(
                          JSON.stringify(
                            buildStrataAssistantPersonaInspectorSnapshot(p.id),
                            null,
                            2
                          )
                        );
                        toast.success("Copied", { description: `${p.shortLabel} inspection JSON` });
                      } catch {
                        toast.error("Could not copy");
                      }
                    })();
                  }}
                >
                  Copy inspection JSON
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Applies to the Strata page assistant. Right-click a persona to inspect. Tool defaults refresh
          when you switch persona.
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assistant tools
        </p>
        <AssistantToolSegmentedPill tools={assistantSession.tools} onToggle={toggleTool} />
      </div>

      <Dialog
        open={inspectorPersonaId !== null}
        onOpenChange={(open) => {
          if (!open) setInspectorPersonaId(null);
        }}
      >
        <DialogContent className="max-h-[min(88vh,44rem)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {inspectorSnapshot ? (
            <>
              <DialogHeader className="border-b border-border/50 px-6 pb-4 pt-5 pr-14 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Strata · Persona inspector
                </p>
                <DialogTitle className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-foreground">
                  {inspectorSnapshot.label}
                </DialogTitle>
                <DialogDescription className="mt-2 space-y-1 text-left text-sm leading-snug text-muted-foreground">
                  <span className="font-mono text-xs text-foreground/85">[{inspectorSnapshot.id}]</span>
                  <span className="mx-1.5 text-border">·</span>
                  <span>{inspectorSnapshot.shortLabel}</span>
                  <span className="mt-1 block text-xs text-muted-foreground/90">
                    Sections below follow a fixed snapshot shape: augmentation text, a table of model
                    and tool defaults, routing notes, then full JSON.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[min(62vh,30rem)] overflow-y-auto px-6 py-5">
                <div
                  className={cn(
                    "prose prose-sm max-w-none dark:prose-invert",
                    "prose-headings:scroll-mt-4 prose-h2:mb-2 prose-h2:mt-6 prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-1.5 prose-h2:text-base prose-h2:font-semibold prose-h2:tracking-tight prose-h2:first:mt-0",
                    "prose-p:leading-relaxed prose-p:text-muted-foreground",
                    "prose-blockquote:border-l-primary/40 prose-blockquote:text-muted-foreground",
                    "prose-table:block prose-table:w-full prose-table:text-xs prose-table:leading-snug",
                    "prose-th:border prose-th:border-border/60 prose-th:bg-muted/40 prose-th:px-2 prose-th:py-1.5 prose-th:font-medium",
                    "prose-td:border prose-td:border-border/50 prose-td:px-2 prose-td:py-1.5",
                    "prose-pre:bg-transparent prose-pre:p-0 prose-pre:shadow-none"
                  )}
                >
                  <ChatMessageMarkdown
                    content={inspectorMarkdown}
                    id={`persona-inspector-${inspectorSnapshot.id}`}
                    wrapCodeBlocks
                  />
                </div>
                <button
                  type="button"
                  className={cn(
                    glass({ opaque: true }),
                    "not-prose mt-5 w-full rounded-md border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                  )}
                  onClick={() => void copyInspectorJson()}
                >
                  Copy full inspection JSON
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
