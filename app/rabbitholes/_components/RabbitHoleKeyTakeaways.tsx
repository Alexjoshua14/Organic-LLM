"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RabbitHoleKeyTakeawaysProps {
  takeaways: string[];
  activeTakeawayIndex?: number | null;
}

export function RabbitHoleKeyTakeaways({
  takeaways,
  activeTakeawayIndex,
}: RabbitHoleKeyTakeawaysProps) {
  const handleTakeawayClick = (index: number) => {
    const sectionId = `takeaway-${index}`;
    const section = document.getElementById(sectionId);

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <motion.div
      className="bg-white/80 dark:bg-[#1C1E1F]/80 backdrop-blur-sm rounded-lg p-8 mb-12 border border-[#DCDDDC] dark:border-[#2A2C2D] shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="font-commissioner text-xs uppercase tracking-[0.2em] text-[#5C5E5E] dark:text-[#A0A2A2] mb-6 font-light">
        Key Takeaways
      </h2>
      <ul className="space-y-4">
        {takeaways.map((takeaway, index) => {
          const isActive = activeTakeawayIndex === index;

          return (
            <motion.li
              key={index}
              className={cn(
                "flex items-start gap-4 font-satoshi text-base leading-relaxed",
                "cursor-pointer transition-all duration-200",
                isActive
                  ? "text-[#2D2B26] dark:text-[#F3F4F3]"
                  : "text-[#5C5E5E] dark:text-[#A0A2A2] hover:text-[#2D2B26] dark:hover:text-[#F3F4F3]",
              )}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.1,
              }}
              onClick={() => handleTakeawayClick(index)}
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
    </motion.div>
  );
}

