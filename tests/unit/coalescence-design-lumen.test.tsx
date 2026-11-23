import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";

import {
  LUMEN_RIM_RATIOS,
  LumenShell,
  kelvinToCss,
  lumenRimGeometry,
} from "@coalescence-labs/design/lumen";

const lumenCss = readFileSync(resolve(import.meta.dir, "../../llm/design/css/lumen.css"), "utf8");
const tailwindCss = readFileSync(
  resolve(import.meta.dir, "../../llm/design/css/tailwind.css"),
  "utf8"
);

afterEach(cleanup);

describe("@coalescence-labs/design lumen — rim geometry", () => {
  test("band spans −3% to +10% of the smaller side, with an 11% blur", () => {
    expect(LUMEN_RIM_RATIOS).toEqual({ inset: 0.03, outset: 0.1, blur: 0.11 });

    const g = lumenRimGeometry(40);

    expect(g.inset).toBeCloseTo(1.2);
    expect(g.outset).toBeCloseTo(4);
    expect(g.band).toBeCloseTo(5.2);
    expect(g.blur).toBeCloseTo(4.4);
    expect(g.bleed).toBeCloseTo(8.4);
  });

  test("LumenShell writes rim geometry and the shell radius from the measured surface", () => {
    const rect = { width: 300, height: 48, top: 0, left: 0, right: 300, bottom: 48, x: 0, y: 0 };
    const original = HTMLElement.prototype.getBoundingClientRect;

    HTMLElement.prototype.getBoundingClientRect = function () {
      return { ...rect, toJSON: () => rect } as DOMRect;
    };

    try {
      const { container } = render(
        <LumenShell className="extra" surface="[data-test-surface]">
          <div data-test-surface style={{ borderRadius: "12px" }} />
        </LumenShell>
      );
      const host = container.querySelector<HTMLElement>(".home-composer-lumen-host")!;

      expect(host.className).toBe("home-composer-lumen-host extra");
      expect(host.querySelector(".home-composer-lumen-rim")).not.toBeNull();
      expect(host.style.getPropertyValue("--cl-lumen-shell-radius")).toBe("12px");
      expect(parseFloat(host.style.getPropertyValue("--cl-lumen-outset"))).toBeCloseTo(4.8);
      expect(parseFloat(host.style.getPropertyValue("--cl-lumen-band"))).toBeCloseTo(6.24);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });

  test("a disabled shell renders no rim", () => {
    const { container } = render(
      <LumenShell enabled={false}>
        <div data-lumen-surface />
      </LumenShell>
    );

    expect(container.querySelector(".home-composer-lumen-rim")).toBeNull();
  });

  test("Kelvin colours are CSS rgb()", () => {
    expect(kelvinToCss(3_000)).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
    expect(kelvinToCss(3_000, 0.5)).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0\.5\)$/);
  });
});

describe("@coalescence-labs/design lumen.css", () => {
  test("every CSS variable it defines or reads carries the --cl- prefix", () => {
    const declared = [...lumenCss.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]!);
    const read = [...lumenCss.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!);

    expect(declared.length).toBeGreaterThan(10);
    expect(read.length).toBeGreaterThan(20);
    expect([...declared, ...read].filter((name) => !name.startsWith("--cl-"))).toEqual([]);
    expect(tailwindCss.match(/var\(--[\w-]+/g)?.every((v) => v.startsWith("var(--cl-"))).toBe(true);
  });

  test("defines the tokens and inputs the spec names", () => {
    for (const token of [
      "--cl-lumen",
      "--cl-lumen-rim",
      "--cl-lumen-deep",
      "--cl-lumen-oklch",
      "--cl-lumen-rim-oklch",
      "--cl-lumen-deep-oklch",
      "--cl-lumen-shadow-rest",
      "--cl-lumen-shadow-hover",
      "--cl-lumen-surface-dark",
      "--cl-lumen-duration",
      "--cl-lumen-ease",
      "--cl-lumen-orb-size",
    ]) {
      expect(lumenCss).toContain(`  ${token}:`);
    }
  });

  test("each rim variant has a dark rim and a light-mode shadow", () => {
    const variants = [
      { rim: "lumen-rim-backlight", lightShadow: ".composer-tool-chip-host:hover .composer-tool-chip" },
      { rim: "home-composer-lumen-rim", lightShadow: ".home-composer-lumen-stage:has(> .home-composer-lumen-rim)" },
      { rim: "chat-style-lumen-rim", lightShadow: ".chat-style-card-stage:has(> .chat-style-lumen-rim)" },
      { rim: "organic-lumen-interactive", lightShadow: ".organic-lumen-interactive:not(:disabled)" },
    ];

    for (const { rim, lightShadow } of variants) {
      expect(lumenCss).toContain(`.dark .${rim}`);
      expect(lumenCss).toMatch(new RegExp(`:root:not\\(\\.dark\\)\\s+${escape(lightShadow)}`));
    }

    expect(lumenCss).toContain(".lumen-orb {");
  });

  test("light mode never shows a warm rim", () => {
    expect(lumenCss).toMatch(
      /:root:not\(\.dark\) \.home-composer-lumen-rim,\s*:root:not\(\.dark\) \.chat-style-lumen-rim \{\s*display: none;/
    );
    expect(lumenCss).toContain(":root:not(.dark) .composer-tool-chip-stage > .lumen-rim-backlight {\n  display: none;");
  });

  test("animations stop under reduced motion", () => {
    const reduced = lumenCss.split("@media (prefers-reduced-motion: reduce)").slice(1).join("");

    for (const selector of [".home-composer-lumen-rim", ".lumen-orb", ".organic-lumen-interactive::before"]) {
      expect(reduced).toContain(selector);
    }
  });
});

describe("@coalescence-labs/design agent skills", () => {
  const skill = (name: string) =>
    readFileSync(resolve(import.meta.dir, `../../llm/design/skills/${name}/SKILL.md`), "utf8");
  const pkg = JSON.parse(
    readFileSync(resolve(import.meta.dir, "../../llm/design/package.json"), "utf8")
  ) as { files: string[] };

  test("ship with the package, alongside the source they read", () => {
    expect(pkg.files).toEqual(expect.arrayContaining(["skills", "src", "css"]));
  });

  test("have frontmatter naming the skill, and transpile links to survey", () => {
    for (const name of ["transpile", "survey"]) {
      expect(skill(name)).toMatch(new RegExp(`^---\\nname: ${name}\\ndescription: .+\\n---\\n`));
    }

    expect(skill("transpile")).toContain("(../survey/SKILL.md)");
  });

  test("never snapshot Lumen's values, so a port always reads the current version", () => {
    for (const name of ["transpile", "survey"]) {
      const text = skill(name);

      expect(text).not.toMatch(/--cl-lumen-[\w-]+\s*:/);
      expect(text).not.toMatch(/\b\d+(?:\.\d+)?(?:px|ms|rem)\b/);
      expect(text).not.toMatch(/\b(?:oklch|rgb)\(\s*\d/);
      expect(text).not.toMatch(/cubic-bezier\(\s*\d/);
    }
  });
});

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
