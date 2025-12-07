"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RabbitHoleTTSButton } from "./RabbitHoleTTSButton";

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
        <h1 className="font-commissioner text-3xl font-light tracking-tight text-[#2D2B26] dark:text-[#F3F4F3] mb-3">
          {title}
        </h1>
        <div className="max-w-xl">
          <RabbitHoleTTSButton nodeId={nodeId} text={articleText} />
        </div>
      </div>
      <div className="bg-white/80 dark:bg-[#1C1E1F]/80 backdrop-blur-sm rounded-lg border border-[#DCDDDC] dark:border-[#2A2C2D] shadow-sm mb-10">
        <button
          type="button"
          onClick={() => setTakeawaysOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <span className="font-commissioner text-xs uppercase tracking-[0.2em] text-[#5C5E5E] dark:text-[#A0A2A2] font-light">
            Key Takeaways
          </span>
          <span className="text-[#5C5E5E] dark:text-[#A0A2A2] text-sm">
            {takeawaysOpen ? "−" : "+"}
          </span>
        </button>
        {takeawaysOpen && (
          <div className="px-5 pb-5">
            <ul className="space-y-4">
              {takeaways.map((takeaway, index) => {
                const isActive = activeTakeawayIndex === index;
                return (
                  <motion.li
                    key={index}
                    className={cn(
                      "flex items-start gap-4 font-satoshi text-base leading-relaxed cursor-pointer transition-all duration-200",
                      isActive
                        ? "text-[#2D2B26] dark:text-[#F3F4F3]"
                        : "text-[#5C5E5E] dark:text-[#A0A2A2] hover:text-[#2D2B26] dark:hover:text-[#F3F4F3]",
                    )}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.05 }}
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
                          ? "text-[#2D2B26] dark:text-[#F3F4F3]"
                          : "text-[#5C5E5E] dark:text-[#A0A2A2]",
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
        )}
      </div>
      <div
        ref={articleRef}
        className={cn(
          "article-content font-satoshi",
          "text-[#5C5E5E] dark:text-[#A0A2A2]",
          "leading-[1.8]",
          "[&_h2]:font-commissioner [&_h2]:text-3xl [&_h2]:font-light [&_h2]:mt-16 [&_h2]:mb-8 [&_h2]:text-[#2D2B26] [&_h2]:dark:text-[#F3F4F3] [&_h2]:tracking-tight",
          "[&_h2[id^='takeaway-']]:scroll-mt-20",
          "[&_h2[id^='takeaway-']]:transition-colors",
          "[&_h3]:font-commissioner [&_h3]:text-2xl [&_h3]:font-light [&_h3]:mt-12 [&_h3]:mb-6 [&_h3]:text-[#2D2B26] [&_h3]:dark:text-[#F3F4F3]",
          "[&_p]:mb-8 [&_p]:text-lg [&_p]:leading-relaxed",
          "[&_strong]:font-medium [&_strong]:text-[#2D2B26] [&_strong]:dark:text-[#F3F4F3]",
          "[&_em]:italic",
          "[&_span[data-branch-id]]:cursor-pointer",
          "[&_span[data-branch-id]]:underline",
          "[&_span[data-branch-id]]:underline-offset-2",
          "[&_span[data-branch-id]]:decoration-[#5C5E5E]/30 dark:[&_span[data-branch-id]]:decoration-[#A0A2A2]/30",
          "[&_span[data-branch-id]]:hover:decoration-[#5C5E5E] dark:[&_span[data-branch-id]]:hover:decoration-[#A0A2A2]",
          "[&_span[data-branch-id]]:hover:text-[#2D2B26] dark:[&_span[data-branch-id]]:hover:text-[#F3F4F3]",
          "[&_span[data-branch-id]]:transition-colors",
          "[&_span[data-branch-id]]:px-0.5",
          "[&_span[data-branch-id]]:rounded",
          "[&_span[data-branch-id]]:hover:bg-white/20 dark:[&_span[data-branch-id]]:hover:bg-[#1C1E1F]/20",
        )}
        dangerouslySetInnerHTML={{ __html: articleHtml }}
      />
    </motion.div>
  );
}

