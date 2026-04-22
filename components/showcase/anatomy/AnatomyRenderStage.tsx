"use client";

import type { RenderStage } from "@/lib/showcase/showcase-trace";

import { motion } from "framer-motion";

import { useAnatomyMotion } from "./anatomy-motion";

import { ArcadiaToolResultCard } from "@/components/chat/chat-message";
import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function AnatomyRenderStage({ stage }: { stage: RenderStage }) {
  const { staggerContainer, staggerItem, fadeIn } = useAnatomyMotion();
  const a = stage.artifact;

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          className="min-w-0 max-w-full"
          {...(fadeIn ?? {})}
          transition={{ delay: 0.05 }}
        >
          <div className="mb-1 text-xs font-medium text-muted-foreground">Raw markdown</div>
          <pre
            className={cn(
              "max-h-64 min-h-0 min-w-0 max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border/60 p-3 text-[11px] leading-relaxed [overflow-wrap:anywhere]",
              glass({ border: "none", opaque: true })
            )}
          >
            {a.rawMarkdown}
          </pre>
        </motion.div>
        <motion.div
          className="min-w-0 max-w-full"
          {...(fadeIn ?? {})}
          transition={{ delay: 0.12 }}
        >
          <div className="mb-1 text-xs font-medium text-muted-foreground">Rendered</div>
          <div
            className={cn(
              "max-h-64 min-h-0 min-w-0 max-w-full overflow-x-auto overflow-y-auto overscroll-x-contain rounded-xl border border-border/60 p-3 text-sm",
              glass({ border: "none", opaque: true }),
              "prose prose-sm max-w-full dark:prose-invert",
              "[&_.mermaid]:mx-auto [&_.mermaid]:block [&_.mermaid]:max-w-full [&_.mermaid]:min-w-0",
              "[&_.mermaid>svg]:!h-auto [&_.mermaid>svg]:!max-w-full",
              "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap"
            )}
          >
            <ChatMessageMarkdown content={a.rawMarkdown} id="showcase-render-md" wrapCodeBlocks />
          </div>
        </motion.div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-muted-foreground">Tool cards</div>
        <motion.div
          className="flex min-w-0 flex-col gap-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
        >
          {a.toolCards.map((card, i) => (
            <motion.div key={`${card.toolName}-${i}`} layout variants={staggerItem}>
              <ArcadiaToolResultCard
                displayBody={card.displayBody}
                isPinned={false}
                toolName={card.toolName}
                onTogglePin={() => {}}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
