"use client";

import { useEffect } from "react";

import { mark } from "@/lib/perf/trace-store";

type PerfMarkProps = {
  name: string;
  detail?: Record<string, unknown>;
};

/** Client mark for server components (e.g. loading.tsx). Renders nothing. */
export function PerfMark({ name, detail }: PerfMarkProps) {
  useEffect(() => {
    mark(name, detail);
  }, [name, detail]);

  return null;
}
