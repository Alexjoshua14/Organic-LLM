import type { Metadata } from "next";

import { MultiagentShowcase } from "@/components/showcase/multiagent/multiagent-showcase";

import "./multiagent.css";

export const metadata: Metadata = {
  title: "Inside the multiagent system | Organic LLM",
  description:
    "An interactive look inside Organic LLM: heartbeat orchestration, persistent agent threads, deliberate context handoffs, specialist tools, and the physics behind Organic Agent.",
};

export default function MultiagentShowcasePage() {
  return <MultiagentShowcase />;
}
