import type { RabbitHoleNode } from "@/lib/schemas/rabbitHoleSchemas";

import { cn } from "@/lib/utils";
import {
  articleContentClasses,
  card,
  heroSpacing,
  layout,
  sectionLabel,
  takeaway,
  title as titleToken,
} from "@/lib/rabbit-holes/designTokens";
import { rabbitHoleDemoProse } from "@/lib/showcase/rabbit-holes";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";

type RabbitHoleDemoArticleProps = {
  node: RabbitHoleNode;
  pathLabel: string;
  showSummary: boolean;
  inspecting: boolean;
};

export function RabbitHoleDemoArticle({
  node,
  pathLabel,
  showSummary,
  inspecting,
}: RabbitHoleDemoArticleProps) {
  const prose = rabbitHoleDemoProse(node.id);

  return (
    <article className={cn("mx-auto min-w-0 max-w-full", layout.articleMaxWidth.desktop)}>
      {inspecting ? (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          You&rsquo;re inspecting this step. Restart the replay to follow the path.
        </p>
      ) : null}
      <p className="mb-3 text-sm leading-relaxed text-foreground/80">{pathLabel}</p>
      <h2 className={cn(titleToken.base, titleToken.compact, "sm:text-3xl")}>
        {node.title ?? node.userQuestion}
      </h2>
      {showSummary ? (
        <>
          {node.summary ? (
            <p className="mb-6 text-base leading-relaxed text-foreground/90">{node.summary}</p>
          ) : null}
          {node.keyTakeaways.length > 0 ? (
            <section className={cn(card, heroSpacing.takeawaysBlock.compact, "sm:mb-8")}>
              <h3 className={cn(sectionLabel, takeaway.padding.compact, "pb-0 sm:px-5 sm:py-4")}>
                Key Takeaways
              </h3>
              <ul
                className={cn(
                  takeaway.listGap.compact,
                  takeaway.innerPadding.compact,
                  "sm:space-y-4 sm:px-5 sm:pb-5"
                )}
              >
                {node.keyTakeaways.map((item) => (
                  <li
                    key={item}
                    className={cn(takeaway.item.base, takeaway.item.size.desktop, "cursor-default")}
                  >
                    <span className={cn(takeaway.bullet, "text-muted-foreground")}>•</span>
                    <span className="min-w-0 flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {prose.length > 0 ? (
            <div className={cn(...articleContentClasses(false))}>
              {prose.map((block) => (
                <p key={block.text}>{block.text}</p>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>{SHOWCASE_STORY.premise}</p>
          <p>
            From {SHOWCASE_STORY.home}, the question on the path is: {node.userQuestion}
          </p>
          <p className="text-foreground/85">The core is {SHOWCASE_STORY.science.coreDistance}.</p>
        </div>
      )}
    </article>
  );
}
