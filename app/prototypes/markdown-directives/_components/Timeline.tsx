"use client";

import { useEffect, useState } from "react";
import type { DirectiveProps } from "../_lib/componentRegistry";
import { resolveDirectiveData } from "../_lib/mockResolver";

/**
 * Example directive component. Renders a simple timeline from mock data
 * keyed by the directive props (e.g. view).
 */
export function Timeline(props: DirectiveProps) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    let cancelled = false;
    resolveDirectiveData("timeline", props).then((resolved) => {
      if (!cancelled) setData(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [props.view, props.query]);

  if (!data) return <div className="text-sm text-muted-foreground">Loading timeline…</div>;
  const events = (data.events as { at: string; text: string }[]) ?? [];
  return (
    <div className="my-2 border-l-2 border-border pl-3">
      {events.map((evt, i) => (
        <div key={i} className="mb-1 text-sm">
          <span className="text-muted-foreground">{evt.at}</span> {evt.text}
        </div>
      ))}
    </div>
  );
}
