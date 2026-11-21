import type { GenUIBlockType } from "@/lib/schemas/gen-ui/shared";

import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import { GEN_UI_LAB_ARCHETYPE_HINTS } from "@/lib/sandbox/gen-ui-lab";
import { designerBlockShapes } from "@/lib/stage/block-shapes";
import { GEN_UI_TOOL_INSTRUCTIONS } from "@/lib/system-prompt/gen-ui";

/** Lab-only Mermaid diagram page (not a gen-UI block type). */
export const LAB_DIAGRAM_INSTRUCTION_MARKDOWN = `
# Diagram

\`mermaid-diagram\` — lab-only gallery page for \`make_mermaid_diagram\` tool results.

## Model instructions

Mermaid diagrams are **not** produced by \`render_gen_ui\`. The chat tool is \`make_mermaid_diagram\`:

- Emit a validated Mermaid source the UI can render.
- Prefer glanceable graphs; denser layouts are available when the user asks for detail.
- Avoid HTML labels and \`click\` handlers — the renderer sanitizes them away.
- Quote labels that contain special characters.

This Gen UI Lab page shows fixture outputs through the same Mermaid chat renderer.
`.trim();

/**
 * Pull the `- {type}: …` bullet (and indented follow-on lines) from Arcadia's
 * \`GEN_UI_TOOL_INSTRUCTIONS\` appendix.
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

/** Markdown the lab shows on the Instructions tab for a gen-UI archetype. */
export function modelInstructionMarkdownForBlock(type: GenUIBlockType): string {
  const label = GEN_UI_REGISTRY[type].label;
  const hint = GEN_UI_LAB_ARCHETYPE_HINTS[type];
  const tip = extractGenUiToolInstruction(type);
  const shape = designerShapeFor(type);
  const sections: string[] = [
    `# ${label}`,
    "",
    `\`${type}\` — ${hint}`,
    "",
    "## Model instructions (`render_gen_ui`)",
    "",
  ];

  if (tip) {
    sections.push(tip, "");
  } else if (type === "research-report") {
    sections.push(
      "Constructed by `research_publish` from saved source/claim ids — do not invent a research-report by hand in `render_gen_ui`.",
      ""
    );
  } else {
    sections.push("_No dedicated Arcadia tip for this type yet._", "");
  }

  sections.push(
    "### Shared rules",
    "",
    "- Call `render_gen_ui` at most **once** per assistant turn.",
    "- Put structured content in the tool payload; brief prose before/after is fine.",
    "- Respect schema size caps listed in the tool instructions appendix.",
    ""
  );

  if (shape) {
    sections.push("## Designer schema shape", "", "```json", shape, "```", "");
  }

  return sections.join("\n").trim();
}
