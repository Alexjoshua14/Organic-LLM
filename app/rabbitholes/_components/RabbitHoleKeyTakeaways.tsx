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
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/80 backdrop-blur-sm rounded-lg p-8 mb-12 border border-border shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="font-commissioner text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6 font-light">
        Key Takeaways
      </h2>
      <ul className="space-y-4">
        {takeaways.map((takeaway, index) => {
          const isActive = activeTakeawayIndex === index;

          return (
            <motion.li
              key={index}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-start gap-4 text-base leading-relaxed",
                "cursor-pointer transition-all duration-200",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              initial={{ opacity: 0, x: -10 }}
              transition={{
                duration: 0.3,
                delay: index * 0.1,
              }}
              whileHover={{ x: 2 }}
              onClick={() => handleTakeawayClick(index)}
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
    </motion.div>
  );
}
