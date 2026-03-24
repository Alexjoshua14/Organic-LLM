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

  // Extract plain text from HTML for TTS
  useEffect(() => {
    if (typeof window !== "undefined" && articleRef.current) {
      // Use the rendered content to extract text
      const text = articleRef.current.textContent || articleRef.current.innerText || "";

      setArticleText(text);
    } else {
      // Fallback: strip HTML tags using regex (less accurate but works on server)
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

  // Intersection Observer to track active section
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
      const idx = index; // capture per-observer index
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

  // Add scroll offset styling for sections
  useEffect(() => {
    const article = articleRef.current;

    if (!article) return;

    const sections = article.querySelectorAll("h2[id^='takeaway-']");

    const margin = compact ? "56px" : "80px";

    sections.forEach((section) => {
      (section as HTMLElement).style.scrollMarginTop = margin;
    });
  }, [articleHtml, compact]);

  return (
    <motion.div
      key={articleHtml}
      animate={{ opacity: 1, y: 0 }}
      className={cn("mx-auto", compact ? "max-w-none" : "max-w-2xl")}
      exit={{ opacity: 0, y: -20 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="snap-start scroll-mt-2 mb-2 min-h-0">
        <h1
          className={cn(
            "font-commissioner font-light tracking-tight text-foreground",
            compact ? "mb-2 text-[26px] leading-snug" : "mb-2 text-3xl"
          )}
        >
          {title}
        </h1>
      </div>
      <div
        className={cn(
          "snap-start scroll-mt-2 max-w-xl min-h-0",
          compact ? "mb-6" : "mb-5"
        )}
      >
        <RabbitHoleTTSButton nodeId={nodeId} text={articleText} />
      </div>

      {showTakeaways && (
        <Collapsible
          className={cn(
            "snap-start scroll-mt-2 bg-card/80 backdrop-blur-sm rounded-lg border border-border shadow-sm",
            compact ? "mb-6" : "mb-8"
          )}
          open={takeawaysOpen}
          onOpenChange={setTakeawaysOpen}
        >
          <CollapsibleTrigger
            className={cn(
              "group flex w-full cursor-pointer items-center justify-between text-left",
              compact ? "px-4 py-3" : "px-5 py-4"
            )}
          >
            <h3 className="font-commissioner text-xs uppercase tracking-[0.2em] text-muted-foreground font-light">
              Key Takeaways
            </h3>
            <span className="text-muted-foreground text-xl group-hover:text-foreground group-hover:scale-110 transition-all duration-400">
              {takeawaysOpen ? "−" : "+"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={cn(compact ? "px-4 pb-4" : "px-5 pb-5")}>
              <ul className={cn(compact ? "space-y-3" : "space-y-4")}>
                {takeaways.map((takeaway, index) => {
                  const isActive = activeTakeawayIndex === index;

                  return (
                    <motion.li
                      key={index}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "flex cursor-pointer items-start gap-4 font-satoshi",
                        compact ? "text-[15px]" : "text-base",
                        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                      initial={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.25, delay: index * 0.05 }}
                      viewport={{ once: true }}
                      whileHover={{ x: 2 }}
                      onClick={() => {
                        const sectionId = `takeaway-${index}`;
                        const section = document.getElementById(sectionId);

                        if (section) {
                          section.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }
                      }}
                    >
                      <span
                        className={cn(
                          "mt-1 shrink-0 transition-colors text-lg",
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        •
                      </span>
                      <span className="flex-1">{takeaway}</span>
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
        className={cn(
          "article-content",
          "text-muted-foreground",
          compact ? "leading-[1.55]" : "leading-[1.65]",
          compact && "overflow-x-hidden",
          compact
            ? "[&_h2]:font-commissioner [&_h2]:text-2xl [&_h2]:font-light [&_h2]:mt-10 [&_h2]:mb-5 [&_h2]:text-foreground [&_h2]:tracking-tight"
            : "[&_h2]:font-commissioner [&_h2]:text-3xl [&_h2]:font-light [&_h2]:mt-16 [&_h2]:mb-8 [&_h2]:text-foreground [&_h2]:tracking-tight",
          compact
            ? "[&_h2[id^='takeaway-']]:scroll-mt-14 [&_h2[id^='takeaway-']]:snap-start"
            : "[&_h2[id^='takeaway-']]:scroll-mt-20 [&_h2[id^='takeaway-']]:snap-start",
          "[&_h2[id^='takeaway-']]:transition-colors",
          compact
            ? "[&_h3]:font-commissioner [&_h3]:text-xl [&_h3]:font-light [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:text-foreground"
            : "[&_h3]:font-commissioner [&_h3]:text-2xl [&_h3]:font-light [&_h3]:mt-12 [&_h3]:mb-6 [&_h3]:text-foreground",
          compact
            ? "[&_p]:mb-6 [&_p]:text-[17px] [&_p]:leading-[1.5]"
            : "[&_p]:mb-8 [&_p]:text-lg [&_p]:leading-[1.5]",
          "[&_code]:break-words [&_code]:font-mono [&_code]:text-sm",
          "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:font-mono [&_pre]:text-sm",
          "[&_img]:max-w-full [&_img]:h-auto",
          "[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto",
          "[&_strong]:font-medium [&_strong]:text-foreground",
          "[&_em]:italic",
          "[&_span[data-branch-id]]:cursor-pointer",
          "[&_span[data-branch-id]]:underline",
          "[&_span[data-branch-id]]:underline-offset-2",
          "[&_span[data-branch-id]]:decoration-muted-foreground/30",
          "[&_span[data-branch-id]]:hover:decoration-muted-foreground",
          "[&_span[data-branch-id]]:hover:text-foreground",
          "[&_span[data-branch-id]]:transition-colors",
          "[&_span[data-branch-id]]:px-0.5",
          "[&_span[data-branch-id]]:rounded",
          "[&_span[data-branch-id]]:hover:bg-card/20"
        )}
      />
    </motion.div>
  );
}
