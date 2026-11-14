import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { SPEAK_AGENT_DOT_WEIGHT, SPEAK_AGENT_GLASS } from "@/app/speak/_components/speak-stage-timing";
import { activityGlassForState, ACTIVITY_GLASS_BY_STATE } from "@/components/agents/activity-mark-glass";
import { AgentDotGrid } from "@/components/agents/agent-dot-grid";
import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { PhysicsAgentDotGrid } from "@/components/agents/physics-agent-dot-grid";

const radii = (html: string) => [...html.matchAll(/<circle[^>]*\sr="([\d.]+)"/g)].map((m) => m[1]);

test("dots keep their original radius unless a weight is given", () => {
  expect(new Set(radii(renderToString(<AgentDotGrid />)))).toEqual(new Set(["2"]));
  expect(new Set(radii(renderToString(<PhysicsAgentDotGrid onFailure={() => {}} />)))).toEqual(
    new Set(["2"])
  );
});

test("dotWeight scales the radius and the glass bead with it, in both renderers", () => {
  const v0 = renderToString(<AgentDotGrid dotWeight={1.4} />);
  const physics = renderToString(<PhysicsAgentDotGrid dotWeight={1.4} onFailure={() => {}} />);

  for (const html of [v0, physics]) {
    expect(new Set(radii(html))).toEqual(new Set(["2.8"]));
    expect(html).toContain('width="5.6"');
    expect(html).toContain('x="-2.8"');
  }
});

test("OrganicActivityMark passes dotWeight through to the dots", () => {
  const html = renderToString(<OrganicActivityMark dotWeight={1.4} renderer="v0" />);

  expect(new Set(radii(html))).toEqual(new Set(["2.8"]));
  expect(new Set(radii(renderToString(<OrganicActivityMark renderer="v0" />)))).toEqual(
    new Set(["2"])
  );
});

test("Speak's glass overrides change only opacity and brightness, and lighten the cover", () => {
  expect(SPEAK_AGENT_DOT_WEIGHT).toBeGreaterThan(1);

  for (const state of ["idle", "working", "waiting", "blocked", "complete"] as const) {
    const speak = activityGlassForState(state, { [state]: SPEAK_AGENT_GLASS[state] });
    const base = ACTIVITY_GLASS_BY_STATE[state];

    expect(speak.blur).toBe(base.blur);
    expect(speak.tint).toBe(base.tint);
    // The cover washes out the dots less than the shared default, except where it was already thin.
    expect(speak.opacity).toBeLessThanOrEqual(Math.max(base.opacity, 0.15));
    expect(speak.brightness).toBeLessThanOrEqual(base.brightness);
  }
  // Listening is the state the page sits in longest; it must no longer be the most washed-out.
  expect(activityGlassForState("waiting", { waiting: SPEAK_AGENT_GLASS.waiting }).opacity).toBe(0.3);
});
