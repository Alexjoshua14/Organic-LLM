"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { RabbitHoleTTSButton } from "./RabbitHoleTTSButton";

import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/third-party/ui/collapsible";
import {
  title as titleToken,
  layout,
  heroSpacing,
  sectionLabel,
  card,
  takeaway,
  articleContent,
  articleContentClasses,
} from "@/lib/rabbit-holes/tokens";

interface RabbitHoleArticleProps {
  title: string;
  takeaways: string[];
  activeTakeawayIndex?: number | null;
  articleHtml: string;
  nodeId: string;
  onBranchClick: (branchId: string) => void;
  onActiveSectionChange?: (index: number | null) => void;
  /** Mobile Safari: tighter type scale and spacing */
  compact?: boolean;
}

export function RabbitHoleArticle({
  title,
  takeaways,
  activeTakeawayIndex,
  articleHtml,
  nodeId,
  onBranchClick,
  onActiveSectionChange,
  compact = false,
}: RabbitHoleArticleProps) {
  const articleRef = useRef<HTMLDivElement>(null);
  const [articleText, setArticleText] = useState("");
  const [takeawaysOpen, setTakeawaysOpen] = useState(true);

  const isStubTakeaways =
    takeaways.length >= 3 &&
    takeaways[0] === "Generating…" &&
    takeaways[1] === "…" &&
    takeaways[2] === "…";
  const showTakeaways = !isStubTakeaways;

  useEffect(() => {
    if (typeof window !== "undefined" && articleRef.current) {
      const text = articleRef.current.textContent || articleRef.current.innerText || "";
      setArticleText(text);
    } else {
      const text = articleHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      setArticleText(text);
    }
  }, [articleHtml]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const branchElement = target.closest("[data-branch-id]") as HTMLElement;
      if (branchElement) {
        const branchId = branchElement.getAttribute("data-branch-id");
        if (branchId) {
          e.preventDefault();
          onBranchClick(branchId);
        }
      }
    };

    article.addEventListener("click", handleClick);
    return () => {
      article.removeEventListener("click", handleClick);
    };
  }, [articleHtml, onBranchClick]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article || !onActiveSectionChange) return;

    const sections = article.querySelectorAll("h2[id^='takeaway-']");
    if (sections.length === 0) return;

    const observerOptions = {
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0,
    };

    const observers: IntersectionObserver[] = [];

    sections.forEach((section, index) => {
      const idx = index;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onActiveSectionChange(idx);
          }
        });
      }, observerOptions);

      observer.observe(section);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [articleHtml, onActiveSectionChange]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    const sections = article.querySelectorAll("h2[id^='takeaway-']");
    const margin = compact
      ? articleContent.scrollMarginTop.compact
      : articleContent.scrollMarginTop.desktop;

    sections.forEach((section) => {
      (section as HTMLElement).style.scrollMarginTop = margin;
    });
  }, [articleHtml, compact]);

  return (
    <motion.div
      key={articleHtml}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mx-auto",
        compact ? layout.articleMaxWidth.compact : layout.articleMaxWidth.desktop
      )}
      exit={{ opacity: 0, y: -20 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className={cn("snap-start scroll-mt-2 min-h-0", heroSpacing.titleBlock)}>
        <h1
          className={cn(
            titleToken.base,
            compact ? titleToken.compact : titleToken.desktop
          )}
        >
          {title}
        </h1>
      </div>
      <div
        className={cn(
          "snap-start scroll-mt-2 min-h-0",
          layout.ttsMaxWidth,
          compact ? heroSpacing.ttsBlock.compact : heroSpacing.ttsBlock.desktop
        )}
      >
        <RabbitHoleTTSButton nodeId={nodeId} text={articleText} />
      </div>

      {showTakeaways && (
        <Collapsible
          className={cn(
            "snap-start scroll-mt-2",
            card,
            compact ? heroSpacing.takeawaysBlock.compact : heroSpacing.takeawaysBlock.desktop
          )}
          open={takeawaysOpen}
          onOpenChange={setTakeawaysOpen}
        >
          <CollapsibleTrigger
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between text-left",
              compact ? takeaway.padding.compact : takeaway.padding.desktop
            )}
          >
            <h3 className={sectionLabel}>Key Takeaways</h3>
            <span className="text-muted-foreground text-xl group-hover:text-foreground group-hover:scale-110 transition-all duration-400">
              {takeawaysOpen ? "−" : "+"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={compact ? takeaway.innerPadding.compact : takeaway.innerPadding.desktop}>
              <ul className={compact ? takeaway.listGap.compact : takeaway.listGap.desktop}>
                {takeaways.map((tw, index) => {
                  const isActive = activeTakeawayIndex === index;
                  return (
                    <motion.li
                      key={index}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        takeaway.item.base,
                        compact ? takeaway.item.size.compact : takeaway.item.size.desktop,
                        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                      initial={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.25, delay: index * 0.05 }}
                      viewport={{ once: true }}
                      whileHover={{ x: 2 }}
                      onClick={() => {
                        const section = document.getElementById(`takeaway-${index}`);
                        if (section) {
                          section.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                    >
                      <span
                        className={cn(
                          takeaway.bullet,
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        •
                      </span>
                      <span className="flex-1">{tw}</span>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div
        dangerouslySetInnerHTML={{ __html: articleHtml }}
        ref={articleRef}
        className={cn(...articleContentClasses(compact))}
      />
    </motion.div>
  );
}
