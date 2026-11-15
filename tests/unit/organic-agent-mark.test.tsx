import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { OrganicAgentMark } from "@/components/agents/organic-agent-mark";
import { StageAgent } from "@/components/stage/stage-agent";
import { StageSubagents } from "@/components/stage/stage-subagents";

const filters = (html: string) => [...html.matchAll(/filter:([^;"]*)/g)].map((m) => m[1]);
const layers = (html: string) => [...html.matchAll(/data-activity-layer="(\w+)"/g)].map((m) => m[1]);

const specialist = {
  id: "agent-1",
  name: "Lyra",
  goal: "Look something up",
  status: "working" as const,
  startedAt: 0,
  result: null,
  memory: false,
  webSearch: false,
};

test("a Stage specialist renders the same material as the main agent", () => {
  const main = renderToString(<StageAgent state="working" status="" onFocus={() => {}} />);
  const child = renderToString(
    <StageSubagents agents={[specialist]} onCancel={async () => {}} />
  );

  expect(layers(child)).toContain("underlay");
  expect(layers(child)).toEqual(layers(main));
  expect(filters(child)).toEqual(filters(main));
  expect(child).toContain("blur(28px)");
});

test("hero applies Speak's size once, and only when asked", () => {
  const hero = renderToString(<OrganicAgentMark hero className="extra" />);
  const plain = renderToString(<OrganicAgentMark className="extra" />);

  expect(hero).toContain("!size-[clamp(7rem,24dvh,13rem)]");
  expect(hero).toContain("!rounded-3xl");
  expect(hero).toContain("extra");
  expect(plain).not.toContain("clamp(7rem");
});
