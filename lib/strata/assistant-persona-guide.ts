/**
 * Strata page assistant — persona guide sections (TOC + markdown bodies stay in sync).
 */
export type StrataAssistantPersonaGuideLevel = 1 | 2 | 3;

export type StrataAssistantPersonaGuideSection = {
  /** Stable DOM id for scroll targets / TOC */
  id: string;
  level: StrataAssistantPersonaGuideLevel;
  title: string;
  /** Short markdown fragment rendered with ChatMessageMarkdown */
  bodyMarkdown: string;
};

export const STRATA_ASSISTANT_PERSONA_GUIDE_SECTIONS: StrataAssistantPersonaGuideSection[] = [
  {
    id: "strata-persona-guide-overview",
    level: 1,
    title: "What persona affects",
    bodyMarkdown: [
      "Persona **adds a tone and domain bias** to the Strata page assistant on each reply.",
      "",
      "- **System prompt**: extra instructions are merged on the server after the base chat prompt and your page grounding (raw / refined / elaborated excerpts).",
      "- **Default model**: when you change persona on the **Source** tab, the composer’s default model is reset to that persona’s pick until you change it again in the model menu.",
      "- **Tool defaults**: switching persona also reapplies that persona’s default Memory / Web / Messages / Knowledge toggles on the Source tab (you can still override them).",
      "",
      "Requests still go through `POST /api/chat` with your thread and `strataAssistantPersona` in the body.",
    ].join("\n"),
  },
  {
    id: "strata-persona-guide-not",
    level: 2,
    title: "What persona does not change",
    bodyMarkdown: [
      "Persona is **not** a second editor for your document.",
      "",
      "| Area | Still yours unless you change it elsewhere |",
      "| --- | --- |",
      "| **Source nodes & raw corpus** | Edited on the **Source** tab only |",
      "| **Refined / Elaborated** | Updated via **Synthesis → Generate**, not by persona |",
      "| **Thread history** | Normal chat persistence; persona does not delete messages |",
    ].join("\n"),
  },
  {
    id: "strata-persona-guide-inspect",
    level: 2,
    title: "Inspect registry details",
    bodyMarkdown: [
      "On the **Source** tab, **right-click** a persona chip and choose **Inspect persona…** for the full registry snapshot (system augmentation, default model, tool defaults, routing note) in a modal.",
      "",
      "Use **Copy inspection JSON** there or from the context menu if you want to diff or archive settings.",
    ].join("\n"),
  },
  {
    id: "strata-persona-guide-tips",
    level: 3,
    title: "Quick tips",
    bodyMarkdown: [
      "- Prefer **Prometheus** for code/systems questions, **Spark** for finance tone, **Remy** for culinary, **Aion** for neutral breadth.",
      "- If replies feel off-topic, switch persona or tighten **Assistant tools** on the Source tab before rewriting sources.",
    ].join("\n"),
  },
];
