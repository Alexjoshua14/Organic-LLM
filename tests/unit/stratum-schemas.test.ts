import { describe, expect, test } from "bun:test";

import {
  formatStratumFormAnswers,
  StratumFormSchema,
  stratumFormToMarkdown,
  stratumSpecToMarkdown,
  StratumSpecSchema,
  tryParseStratumFormToolOutput,
  tryParseStratumSpecToolOutput,
  type StratumForm,
  type StratumSpec,
} from "@/lib/schemas/stratum";

const VALID_FORM: StratumForm = {
  type: "stratum-form",
  version: 1,
  stage: "concept",
  title: "What are we building?",
  intro: "A few questions to anchor the idea.",
  fields: [
    {
      kind: "long_text",
      id: "pitch",
      label: "Describe the idea in your own words",
      placeholder: "No wrong answers",
    },
    {
      kind: "single_select",
      id: "platform",
      label: "Primary platform",
      options: [
        { id: "ios", label: "iOS app" },
        { id: "web", label: "Web app" },
      ],
      allowCustom: true,
    },
    {
      kind: "multi_select",
      id: "capabilities",
      label: "Which capabilities matter?",
      options: [
        { id: "offline", label: "Offline" },
        { id: "realtime", label: "Realtime sync" },
        { id: "ai", label: "AI features" },
      ],
    },
    {
      kind: "scale",
      id: "polish",
      label: "How polished must v1 feel?",
      minLabel: "rough prototype",
      maxLabel: "app-store ready",
      optional: true,
    },
  ],
};

const VALID_SPEC: StratumSpec = {
  type: "stratum-spec",
  version: 1,
  name: "Glasswing",
  tagline: "iOS-native idea capture",
  summary: "A liquid-glass iOS app for capturing and structuring ideas.",
  problem: "Ideas evaporate before they are structured.",
  audience: ["Solo builders"],
  features: [
    { id: "capture", title: "Instant capture", priority: "must" },
    { id: "share", title: "Share sheets", detail: "System share integration", priority: "could" },
  ],
  architecture: {
    overview: "SwiftUI client with a thin sync backend.",
    components: [{ id: "client", name: "iOS client", role: "Capture and browse", stack: "SwiftUI" }],
    dataFlows: ["Capture → local store → background sync"],
  },
  risks: ["Scope creep"],
  openQuestions: ["Monetization model"],
  handoffs: [
    {
      id: "client-brief",
      title: "iOS client brief",
      target: "Cursor",
      body: "Build a SwiftUI app that captures ideas offline-first…",
    },
  ],
  coverage: 62,
};

describe("stratum form schema", () => {
  test("parses a valid form with all field kinds", () => {
    const parsed = StratumFormSchema.safeParse(VALID_FORM);

    expect(parsed.success).toBe(true);
  });

  test("rejects a form with an unknown field kind", () => {
    const parsed = StratumFormSchema.safeParse({
      ...VALID_FORM,
      fields: [{ kind: "date", id: "when", label: "When?" }],
    });

    expect(parsed.success).toBe(false);
  });

  test("rejects empty fields and caps at 6", () => {
    expect(StratumFormSchema.safeParse({ ...VALID_FORM, fields: [] }).success).toBe(false);
    const sevenFields = Array.from({ length: 7 }, (_, i) => ({
      kind: "text" as const,
      id: `f${i}`,
      label: `Field ${i}`,
    }));

    expect(StratumFormSchema.safeParse({ ...VALID_FORM, fields: sevenFields }).success).toBe(false);
  });

  test("unknown stage falls back to concept", () => {
    const parsed = StratumFormSchema.safeParse({ ...VALID_FORM, stage: "vibes" });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.stage).toBe("concept");
  });
});

describe("stratum tool output parsing", () => {
  test("round-trips form and spec tool outputs", () => {
    expect(tryParseStratumFormToolOutput({ kind: "stratum-form", form: VALID_FORM })?.form.title).toBe(
      VALID_FORM.title
    );
    expect(tryParseStratumSpecToolOutput({ kind: "stratum-spec", spec: VALID_SPEC })?.spec.name).toBe(
      "Glasswing"
    );
  });

  test("rejects mismatched kinds", () => {
    expect(tryParseStratumFormToolOutput({ kind: "stratum-spec", spec: VALID_SPEC })).toBeNull();
    expect(tryParseStratumSpecToolOutput(null)).toBeNull();
  });
});

describe("formatStratumFormAnswers", () => {
  test("serializes each answer kind and marks skipped fields", () => {
    const message = formatStratumFormAnswers(VALID_FORM, {
      pitch: "An iOS app for capturing ideas",
      platform: "iOS app",
      capabilities: ["Offline", "AI features"],
    });

    expect(message).toContain("Discovery answers — What are we building? (concept)");
    expect(message).toContain("- Describe the idea in your own words: An iOS app for capturing ideas");
    expect(message).toContain("- Primary platform: iOS app");
    expect(message).toContain("- Which capabilities matter?: Offline, AI features");
    expect(message).toContain("- How polished must v1 feel?: _skipped_");
  });

  test("scale answers render as n/5", () => {
    const message = formatStratumFormAnswers(VALID_FORM, { polish: 4 });

    expect(message).toContain("- How polished must v1 feel?: 4/5");
  });

  test("whitespace-only answers count as skipped", () => {
    const message = formatStratumFormAnswers(VALID_FORM, { pitch: "   " });

    expect(message).toContain("- Describe the idea in your own words: _skipped_");
  });
});

describe("stratum markdown fallbacks", () => {
  test("form markdown lists fields and options", () => {
    const md = stratumFormToMarkdown(VALID_FORM);

    expect(md).toContain("## What are we building?");
    expect(md).toContain("- **Primary platform**");
    expect(md).toContain("  - iOS app");
    expect(md).toContain("1 = rough prototype … 5 = app-store ready");
  });

  test("spec markdown includes every populated section", () => {
    const parsed = StratumSpecSchema.parse(VALID_SPEC);
    const md = stratumSpecToMarkdown(parsed);

    expect(md).toContain("# Glasswing");
    expect(md).toContain("## Features");
    expect(md).toContain("**[Must] Instant capture**");
    expect(md).toContain("## Architecture");
    expect(md).toContain("**iOS client** — Capture and browse (SwiftUI)");
    expect(md).toContain("## Handoff chunks");
    expect(md).toContain("### iOS client brief (Cursor)");
  });
});
