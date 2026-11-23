"use client";

import type { ErgonProposalBlock as ErgonProposalBlockData } from "@/lib/schemas/gen-ui";

import { ErgonProposalView } from "../ergon/ErgonProposalView";

type ErgonProposalProps = {
  block: ErgonProposalBlockData;
  partial?: boolean;
  apply?: () => Promise<void>;
};

export function ErgonProposal({ block, partial, apply }: ErgonProposalProps) {
  return <ErgonProposalView block={block} partial={partial} apply={apply} />;
}
