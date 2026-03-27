"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { card, sectionLabel, takeaway } from "@/lib/rabbit-holes/designTokens";

interface RabbitHoleKeyTakeawaysProps {
  takeaways: string[];
  activeTakeawayIndex?: number | null;
}

export function RabbitHoleKeyTakeaways({
  takeaways,
  activeTakeawayIndex,
}: RabbitHoleKeyTakeawaysProps) {
  const handleTakeawayClick = (index: number) => {
    const section = document.getElementById(`takeaway-${index}`);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(card, "p-8 mb-12")}
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className={cn(sectionLabel, "mb-6")}>Key Takeaways</h2>
      <ul className={takeaway.listGap.desktop}>
        {takeaways.map((tw, index) => {
          const isActive = activeTakeawayIndex === index;

          return (
            <motion.li
              key={index}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                takeaway.item.base,
                takeaway.item.size.desktop,
                "leading-relaxed transition-all duration-200",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              initial={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ x: 2 }}
              onClick={() => handleTakeawayClick(index)}
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
    </motion.div>
  );
}
