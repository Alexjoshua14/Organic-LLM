"use client";

import type { MeasureBlock as MeasureBlockData } from "@/lib/schemas/gen-ui";

import { MeasureView } from "../measure/MeasureView";

type MeasureProps = {
  block: MeasureBlockData;
  partial?: boolean;
};

export function Measure({ block, partial }: MeasureProps) {
  return <MeasureView block={block} partial={partial} />;
}
