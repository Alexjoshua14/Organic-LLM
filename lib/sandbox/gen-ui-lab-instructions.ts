import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import { GEN_UI_LAB_ARCHETYPE_HINTS } from "@/lib/sandbox/gen-ui-lab";
import { isGenUIBlockType, type GenUIBlockType } from "@/lib/schemas/gen-ui";
import { designerBlockShapes } from "@/lib/stage/block-shapes";
import { GEN_UI_TOOL_INSTRUCTIONS } from "@/lib/system-prompt/gen-ui";

export type LabInstructionSection = {
  id: string;
  title: string;
  /** One-line peek when the section is collapsed. */
  summary: string;
  /** Markdown body rendered inside the open section. */
  body: string;
  defaultOpen?: boolean;
};

export type LabInstructionDoc = {
  eyebrow: string;
  title: string;
  typeId: string;
  hint: string;
  sections: LabInstructionSection[];
};

const SHARED_RULES_BODY = [
  "- Call `render_gen_ui` at most **once** per assistant turn.",
  "- Put structured content in the tool payload; brief prose before/after is fine.",
  "- Respect schema size caps listed in the tool instructions appendix.",
].join("\n");

/** Lab-only Mermaid diagram page (not a gen-UI block type). */
export const LAB_DIAGRAM_INSTRUCTION_DOC: LabInstructionDoc = {
  eyebrow: "Gen UI · Lab page",
  title: "Diagram",
  typeId: "mermaid-diagram",
  hint: "lab-only gallery page for `make_mermaid_diagram` tool results",
  sections: [
    {
      id: "tool",
      title: "Model instructions",
      summary: "make_mermaid_diagram — not render_gen_ui",
      defaultOpen: true,
      body: [
        "Mermaid diagrams are **not** produced by `render_gen_ui`. The chat tool is `make_mermaid_diagram`:",
        "",
        "- Emit dual-source JSON: `overviewCode` (gist) + `detailedCode` (full), shared node IDs.",
        "- Declare density: `glance` (≤5 nodes), `overview` (6–12), `detailed` (13+).",
        "- Allowed types: flowchart, sequenceDiagram, stateDiagram-v2, classDiagram, erDiagram.",
        "- Avoid HTML labels and `click` handlers — the renderer sanitizes them away.",
        "- Quote labels that contain special characters.",
        "",
        "This Gen UI Lab page cycles showcase outputs (flowchart, sequence, state, ER, densities) through the same Mermaid chat renderer.",
      ].join("\n"),
    },
  ],
};

/** @deprecated Prefer `LAB_DIAGRAM_INSTRUCTION_DOC`. Kept for callers that still want a single markdown blob. */
export const LAB_DIAGRAM_INSTRUCTION_MARKDOWN = labInstructionDocToMarkdown(LAB_DIAGRAM_INSTRUCTION_DOC);

/**
 * Pull the `- {type}: …` bullet (and indented follow-on lines) from Arcadia's
 * `GEN_UI_TOOL_INSTRUCTIONS` appendix.
 */
export function extractGenUiToolInstruction(type: GenUIBlockType): string | null {
  const lines = GEN_UI_TOOL_INSTRUCTIONS.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`- ${type}:`));

  if (start < 0) return null;

  const collected: string[] = [lines[start]!.slice(2)]; // drop leading "- "

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;

    if (/^- [a-z0-9-]+:/i.test(line) || line.startsWith("When NOT to use")) break;
    collected.push(line);
  }

  return collected.join("\n").trim();
}

function designerShapeFor(type: GenUIBlockType): string | null {
  const line = designerBlockShapes()
    .split("\n")
    .find((entry) => entry.startsWith(`${type}:`));

  if (!line) return null;

  const json = line.slice(type.length + 2);

  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function tipBodyFor(type: GenUIBlockType): string {
  const tip = extractGenUiToolInstruction(type);

  if (tip) return tip;
  if (type === "research-report") {
    return "Constructed by `research_publish` from saved source/claim ids — do not invent a research-report by hand in `render_gen_ui`.";
  }

  return "_No dedicated Arcadia tip for this type yet._";
}

/** Structured instruction document for the Gen UI Lab Instructions tab. */
export function modelInstructionDocForBlock(type: GenUIBlockType): LabInstructionDoc {
  const label = GEN_UI_REGISTRY[type].label;
  const hint = GEN_UI_LAB_ARCHETYPE_HINTS[type];
  const shape = designerShapeFor(type);
  const sections: LabInstructionSection[] = [
    {
      id: "model",
      title: "Model instructions",
      summary: "`render_gen_ui` tip for this archetype",
      defaultOpen: true,
      body: tipBodyFor(type),
    },
    {
      id: "shared",
      title: "Shared rules",
      summary: "Once per turn · payload · schema caps",
      defaultOpen: false,
      body: SHARED_RULES_BODY,
    },
  ];

  if (shape) {
    sections.push({
      id: "schema",
      title: "Designer schema shape",
      summary: "JSON shape passed to the stage designer",
      defaultOpen: false,
      body: ["```json", shape, "```"].join("\n"),
    });
  }

  return {
    eyebrow: "Gen UI · Model instructions",
    title: label,
    typeId: type,
    hint,
    sections,
  };
}

export function labInstructionDocToMarkdown(doc: LabInstructionDoc): string {
  const parts: string[] = [
    `# ${doc.title}`,
    "",
    `\`${doc.typeId}\` — ${doc.hint}`,
    "",
  ];

  for (const section of doc.sections) {
    parts.push(`## ${section.title}`, "", section.body, "");
  }

  return parts.join("\n").trim();
}

/** Markdown form of the structured doc (tests / copy). */
export function modelInstructionMarkdownForBlock(type: GenUIBlockType): string {
  return labInstructionDocToMarkdown(modelInstructionDocForBlock(type));
}

/** Resolve the instruction doc for any lab archetype id (block or lab-only). */
export function instructionDocForArchetype(archetype: string): LabInstructionDoc | null {
  if (archetype === "mermaid-diagram") return LAB_DIAGRAM_INSTRUCTION_DOC;
  if (isGenUIBlockType(archetype)) return modelInstructionDocForBlock(archetype);

  return null;
}
