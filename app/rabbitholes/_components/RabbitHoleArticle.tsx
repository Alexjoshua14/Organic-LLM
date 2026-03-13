"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RabbitHoleTTSButton } from "./RabbitHoleTTSButton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/third-party/ui/collapsible";

interface RabbitHoleArticleProps {
  title: string;
  takeaways: string[];
  activeTakeawayIndex?: number | null;
  articleHtml: string;
  nodeId: string;
  onBranchClick: (branchId: string) => void;
  onActiveSectionChange?: (index: number | null) => void;
}

export function RabbitHoleArticle({
  title,
  takeaways,
  activeTakeawayIndex,
  articleHtml,
  nodeId,
  onBranchClick,
  onActiveSectionChange,
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
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(
    null,
  );

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
            setActiveSectionIndex(idx);
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
    sections.forEach((section) => {
      (section as HTMLElement).style.scrollMarginTop = "80px";
    });
  }, [articleHtml]);

  return (
    <motion.div
      key={articleHtml}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="max-w-2xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="font-commissioner text-3xl font-light tracking-tight text-foreground mb-3">
          {title}
        </h1>
        <div className="max-w-xl">
          <RabbitHoleTTSButton nodeId={nodeId} text={articleText} />
        </div>
      </div>

      {showTakeaways && (
        <Collapsible
          open={takeawaysOpen}
          onOpenChange={setTakeawaysOpen}
          className="bg-card/80 backdrop-blur-sm rounded-lg border border-border shadow-sm mb-10">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer group">
            <h3 className="font-commissioner text-xs uppercase tracking-[0.2em] text-muted-foreground font-light">
              Key Takeaways
            </h3>
            <span className="text-muted-foreground text-xl group-hover:text-foreground group-hover:scale-110 transition-all duration-400">
              {takeawaysOpen ? "−" : "+"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-5">
              <ul className="space-y-4">
                {takeaways.map((takeaway, index) => {
                  const isActive = activeTakeawayIndex === index;
                  return (
                    <motion.li
                      key={index}
                      className={cn(
                        "flex items-start gap-4 font-satoshi text-base cursor-pointer",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.05 }}
                      viewport={{ once: true }}
                      onClick={() => {
                        const sectionId = `takeaway-${index}`;
                        const section = document.getElementById(sectionId);
                        if (section) {
                          section.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                      whileHover={{ x: 2 }}
                    >
                      <span
                        className={cn(
                          "mt-1 shrink-0 transition-colors text-lg",
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground",
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
        ref={articleRef}
        className={cn(
          "article-content",
          "text-muted-foreground",
          "leading-[1.8]",
          "[&_h2]:font-commissioner [&_h2]:text-3xl [&_h2]:font-light [&_h2]:mt-16 [&_h2]:mb-8 [&_h2]:text-foreground [&_h2]:tracking-tight",
          "[&_h2[id^='takeaway-']]:scroll-mt-20",
          "[&_h2[id^='takeaway-']]:transition-colors",
          "[&_h3]:font-commissioner [&_h3]:text-2xl [&_h3]:font-light [&_h3]:mt-12 [&_h3]:mb-6 [&_h3]:text-foreground",
          "[&_p]:mb-8 [&_p]:text-lg [&_p]:leading-relaxed",
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
          "[&_span[data-branch-id]]:hover:bg-card/20",
        )}
        dangerouslySetInnerHTML={{ __html: articleHtml }}
      />
    </motion.div>
  );
}

