export const OPEN_IN_CHAT_PROVIDERS = ["chatgpt", "claude", "t3", "v0", "scira"] as const;
export type OpenInChatProvider = (typeof OPEN_IN_CHAT_PROVIDERS)[number];

export type ExportOpenInTarget = {
  kind: "open-in-chat";
  providers: OpenInChatProvider[];
};

export type ExportClipboardTarget = {
  kind: "clipboard";
  app: "cursor";
};

export type ExportTarget = ExportOpenInTarget | ExportClipboardTarget;

export type ExportFormat = "open_in_chat" | "cursor";

export type ExportIntentPreset = {
  id: string;
  version: number;
  targets: ExportTarget[];
  buttonLabel: string;
  label: string;
  descriptor?: string;
  question: string;
  requestedFormat: string;
  contextPlaceholder?: string;
  validate?: (sourceText: string) => { ok: true } | { ok: false; message: string };
};

export function inferExportFormat(preset: ExportIntentPreset): ExportFormat {
  const hasOpen = preset.targets.some((t) => t.kind === "open-in-chat");

  if (hasOpen) return "open_in_chat";
  const hasCursor = preset.targets.some((t) => t.kind === "clipboard" && t.app === "cursor");

  if (hasCursor) return "cursor";

  return "open_in_chat";
}

export function getOpenInChatProviders(preset: ExportIntentPreset): OpenInChatProvider[] {
  const out: OpenInChatProvider[] = [];

  for (const t of preset.targets) {
    if (t.kind === "open-in-chat") {
      for (const p of t.providers) {
        if (!out.includes(p)) out.push(p);
      }
    }
  }

  return out;
}

export function presetHasClipboardCursor(preset: ExportIntentPreset): boolean {
  return preset.targets.some((t) => t.kind === "clipboard" && t.app === "cursor");
}

export function buildChatGptPrompt(args: {
  preset: ExportIntentPreset;
  sourceText: string;
  userContext?: string;
}): string {
  const { preset, sourceText, userContext } = args;

  return `You are helping Organic LLM import knowledge from external systems.

Task
- Focus area: ${preset.label}
- User-facing question: ${preset.question}
- Requested output format: ${preset.requestedFormat}

User-provided context
${userContext?.trim() || "(No additional context provided.)"}

Organic LLM source context
${sourceText}

Please return only the final answer in the requested format, concise but complete, optimized for direct copy into Organic LLM.`;
}

export function buildCursorInstruction(args: {
  preset: ExportIntentPreset;
  sourceText: string;
  userContext?: string;
}): string {
  const { preset, sourceText, userContext } = args;

  return `Cursor instruction package

Action
- ${preset.label}
- Question: ${preset.question}
- Output contract: ${preset.requestedFormat}

User context
${userContext?.trim() || "(No additional context provided.)"}

Source material
${sourceText}

Implementation notes
- Keep response strictly in requested format.
- Prefer concise, verifiable details.
- Flag uncertainties explicitly.`;
}

export const EXPORT_INTENT_PRESETS: ExportIntentPreset[] = [
  {
    id: "script-storyboard-chatgpt",
    version: 1,
    targets: [{ kind: "open-in-chat", providers: ["chatgpt"] }],
    buttonLabel: "Request storyboard script from ChatGPT",
    label: "Storyboard script",
    descriptor: "storyboard",
    question: "Can you turn this into a clean storyboard-ready script?",
    requestedFormat: "Markdown with sections: Hook, Beat-by-beat Script, On-screen Cues, and CTA.",
    contextPlaceholder: "Audience, tone, runtime, and constraints...",
  },
  {
    id: "script-voiceover-chatgpt",
    version: 1,
    targets: [{ kind: "open-in-chat", providers: ["chatgpt", "claude"] }],
    buttonLabel: "Request polished script from ChatGPT",
    label: "Polished script",
    descriptor: "polished",
    question: "Can you refine this into a polished user-facing script?",
    requestedFormat: "Markdown with sections: Final Script, Optional Variants, and Delivery Notes.",
    contextPlaceholder: "Voice, style, reading level, and hard requirements...",
    validate: (sourceText) =>
      sourceText.trim().length >= 40
        ? { ok: true }
        : {
            ok: false,
            message: "Draft export needs at least 40 characters so ChatGPT has enough context.",
          },
  },
  {
    id: "cursor-code-analysis",
    version: 1,
    targets: [{ kind: "clipboard", app: "cursor" }],
    buttonLabel: "Analyze code with Cursor",
    label: "Cursor code analysis",
    question: "Analyze this code/design context and propose actionable changes.",
    requestedFormat: "Bullet list with: Findings, Risks, Suggested Edits, and Verification Steps.",
    contextPlaceholder: "Repo constraints, target files, and preferred coding style...",
  },
  {
    id: "architecture-brief-chatgpt",
    version: 1,
    targets: [{ kind: "open-in-chat", providers: ["chatgpt"] }],
    buttonLabel: "Request architecture brief from ChatGPT",
    label: "Organic LLM architecture brief",
    question:
      "What architecture details should we capture so another AI can reason accurately about this system?",
    requestedFormat:
      "Concise markdown brief with sections: System Map, Data Flow, Constraints, and Unknowns.",
    contextPlaceholder: "Subsystem focus, depth level, and key assumptions...",
  },
  {
    id: "career-profile-chatgpt",
    version: 1,
    targets: [{ kind: "open-in-chat", providers: ["chatgpt"] }],
    buttonLabel: "Request career-profile extraction from ChatGPT",
    label: "User career ambitions capture",
    question:
      "What career ambitions, milestones, and constraints should Organic LLM remember for better coaching?",
    requestedFormat:
      "JSON with keys: ambitions, milestones, constraints, evidence, confidence (0-1).",
    contextPlaceholder: "Career stage, timeline, constraints, and preferences...",
  },
];

export function getExportIntentPreset(id: string): ExportIntentPreset | undefined {
  return EXPORT_INTENT_PRESETS.find((preset) => preset.id === id);
}
