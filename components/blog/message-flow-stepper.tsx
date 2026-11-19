import { BlogFigure } from "./blog-figure";

import { GuidedSteps } from "@/components/shared/guided-steps";

export type FlowStep = {
  /** Short, in the reader's terms: "You press send". */
  title: string;
  /** What you notice, if anything. */
  seen: string;
  /** What the server does, in one sentence with the real names. */
  behind: string;
};

/**
 * Follow one exchange from the first action to a finished, saved result, as a blog figure. The
 * steps are data, so the post owns its words; the interaction and its motion live in the shared
 * GuidedSteps.
 */
export function MessageFlowStepper({
  steps,
  caption = "Click through one message, from send to saved.",
}: {
  steps: readonly FlowStep[];
  caption?: string;
}) {
  return (
    <BlogFigure caption={caption}>
      <GuidedSteps
        steps={steps.map((s) => ({
          title: s.title,
          fields: [
            { label: "What you see", text: s.seen },
            { label: "Behind the scenes", text: s.behind },
          ],
        }))}
      />
    </BlogFigure>
  );
}
