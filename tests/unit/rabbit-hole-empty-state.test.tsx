import type React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { FeatureHintRegistryProvider } from "@/lib/onboarding/feature-hint-context";
import { RabbitHoleEmptyState } from "@/components/rabbit-holes/main/RabbitHoleEmptyState";

function renderEmptyState(node: React.ReactElement) {
  return renderToStaticMarkup(
    <FeatureHintRegistryProvider>{node}</FeatureHintRegistryProvider>
  );
}

describe("RabbitHoleEmptyState", () => {
  test("renders guided prompts", () => {
    const html = renderEmptyState(<RabbitHoleEmptyState />);

    expect(html).toContain("Chat in the drawer");
    expect(html).toContain("Explore a question");
    expect(html).toContain("Follow branches");
  });

  test("compact mode omits focus shortcut", () => {
    const html = renderEmptyState(<RabbitHoleEmptyState compact />);

    expect(html).not.toContain("focus mode");
  });

  test("starter prompts call onExplore", () => {
    let called: string | null = null;

    const html = renderEmptyState(
      <RabbitHoleEmptyState
        onStarterPrompt={(q) => {
          called = q;
        }}
      />
    );

    expect(html).toContain("What should I explore first?");
    expect(called).toBeNull();
  });
});
