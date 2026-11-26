import type { ReactNode } from "react";
import type { GenUIBlock } from "@/lib/schemas/gen-ui";

import { AnswerCard } from "@/components/chat/gen-ui/blocks/AnswerCard";
import { AudioSnippet } from "@/components/chat/gen-ui/blocks/AudioSnippet";
import { AuditLine } from "@/components/chat/gen-ui/blocks/AuditLine";
import { CodeDiff } from "@/components/chat/gen-ui/blocks/CodeDiff";
import { ContextSwitchboard } from "@/components/chat/gen-ui/blocks/ContextSwitchboard";
import { ErgonBoard } from "@/components/chat/gen-ui/blocks/ErgonBoard";
import { ErgonProposal } from "@/components/chat/gen-ui/blocks/ErgonProposal";
import { HypGraph } from "@/components/chat/gen-ui/blocks/HypGraph";
import { PlanTimeline } from "@/components/chat/gen-ui/blocks/PlanTimeline";
import { PreviewBlob } from "@/components/chat/gen-ui/blocks/PreviewBlob";
import { ProfileMap } from "@/components/chat/gen-ui/blocks/ProfileMap";
import { ProgressTrack } from "@/components/chat/gen-ui/blocks/ProgressTrack";
import { PromptField } from "@/components/chat/gen-ui/blocks/PromptField";
import { RecipeCard } from "@/components/chat/gen-ui/blocks/RecipeCard";
import { ResearchReport } from "@/components/chat/gen-ui/blocks/ResearchReport";
import { RestaurantCard } from "@/components/chat/gen-ui/blocks/restaurant-card/RestaurantCard";
import { RipplePreview } from "@/components/chat/gen-ui/blocks/RipplePreview";
import { ShoppingList } from "@/components/chat/gen-ui/blocks/ShoppingList";
import { StateDiagram } from "@/components/chat/gen-ui/blocks/StateDiagram";
import { MeasureView } from "@/components/chat/gen-ui/measure/MeasureView";

/** Common heading and reading width for the lab's demo-owned condensed views. */
export function CondensedCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-sm space-y-stack-sm text-sm wrap-anywhere">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </article>
  );
}

/** Reading width shared by every condensed block; each block owns its condensed visual. */
function Condensed({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-sm min-w-0">{children}</div>;
}

/**
 * Condensed is the same component at a glanceable size, never a text summary. Each block
 * renders its own `condensed` view; `children` (the full block) is offered only where the
 * condensed view drops content a reader may still want, and never where it would duplicate
 * actions the condensed view keeps.
 */
export function GenUiCondensedBlock({
  block,
  children,
}: {
  block: GenUIBlock;
  children?: ReactNode;
}) {
  switch (block.type) {
    case "decision-matrix":
      // The decision demo owns criterion selection.
      return children;
    case "restaurant-card":
      return (
        <Condensed>
          <RestaurantCard block={block} condensed />
        </Condensed>
      );
    case "measure":
      return <MeasureView block={block} condensed />;
    case "answer-card":
      return (
        <Condensed>
          <AnswerCard block={block} condensed />
        </Condensed>
      );
    case "plan-timeline":
      return (
        <Condensed>
          <PlanTimeline block={block} variant="condensed" />
        </Condensed>
      );
    case "audio-snippet":
      return (
        <Condensed>
          <AudioSnippet block={block} condensed />
        </Condensed>
      );
    case "recipe-card":
      return (
        <Condensed>
          <RecipeCard block={block} condensed />
        </Condensed>
      );
    case "shopping-list":
      return (
        <Condensed>
          <ShoppingList block={block} condensed />
        </Condensed>
      );
    case "research-report":
      return (
        <Condensed>
          <ResearchReport block={block} condensed />
        </Condensed>
      );
    case "profile-map":
      return (
        <Condensed>
          <ProfileMap block={block} condensed />
        </Condensed>
      );
    case "ergon-board":
      return (
        <Condensed>
          <ErgonBoard block={block} condensed />
        </Condensed>
      );
    case "ergon-proposal":
      return (
        <Condensed>
          <ErgonProposal block={block} condensed />
        </Condensed>
      );
    case "state-diagram":
      return (
        <Condensed>
          <StateDiagram block={block} condensed />
        </Condensed>
      );
    case "prompt-field":
      return (
        <Condensed>
          <PromptField block={block} condensed />
        </Condensed>
      );
    case "progress-track":
      return (
        <Condensed>
          <ProgressTrack block={block} condensed />
        </Condensed>
      );
    case "context-switchboard":
      return (
        <Condensed>
          <ContextSwitchboard block={block} condensed />
        </Condensed>
      );
    case "ripple-preview":
      return (
        <Condensed>
          <RipplePreview block={block} condensed />
        </Condensed>
      );
    case "hyp-graph":
      return (
        <Condensed>
          <HypGraph block={block} condensed />
        </Condensed>
      );
    case "audit-line":
      return (
        <Condensed>
          <AuditLine block={block} condensed />
        </Condensed>
      );
    case "preview-blob":
      return (
        <Condensed>
          <PreviewBlob block={block} condensed />
        </Condensed>
      );
    case "code-diff":
      return (
        // The diff grows into its full view in place, so no second copy is offered here.
        <Condensed>
          <CodeDiff block={block} condensed />
        </Condensed>
      );
  }
}
