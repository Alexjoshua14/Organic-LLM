"use client";

import type { ErgonBoardBlock as ErgonBoardBlockData } from "@/lib/schemas/gen-ui";

import { ErgonBoardView } from "../ergon/ErgonBoardView";

type ErgonBoardProps = {
  block: ErgonBoardBlockData;
  partial?: boolean;
};

export function ErgonBoard({ block, partial }: ErgonBoardProps) {
  return <ErgonBoardView block={block} partial={partial} />;
}
