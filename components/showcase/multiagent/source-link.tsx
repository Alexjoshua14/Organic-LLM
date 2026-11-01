import { ArrowUpRight } from "lucide-react";

import { sourceHref } from "@/lib/showcase/multiagent/content";

export function SourceLink({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <a className="ma-source" href={sourceHref(path)} target="_blank" rel="noreferrer">
      {children} <ArrowUpRight size={14} aria-hidden />
    </a>
  );
}
