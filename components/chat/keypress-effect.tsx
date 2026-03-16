"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { KeyAnimationConfig } from "@/lib/utils/key-categorization";

type KeypressEffectProps = {
  effect: (KeyAnimationConfig & { id: number }) | null;
};

export const KeypressEffect: React.FC<KeypressEffectProps> = ({ effect }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {effect ? (
        <motion.div
          key={effect.id}
          animate={{ opacity: effect.opacity }}
          className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: effect.duration / 1000, ease: "easeOut" }}
        >
          <motion.div
            animate={{
              scale: effect.direction === "pulse" ? 1.05 : 1.02,
              y: 0,
            }}
            className="absolute inset-0"
            exit={{
              scale: 1.08,
              y: effect.direction === "up" ? -12 : effect.direction === "down" ? 12 : 0,
            }}
            initial={{
              scale: 0.95,
              y: effect.direction === "up" ? 24 : effect.direction === "down" ? -24 : 0,
            }}
            style={{
              background: `radial-gradient(circle at 50% 60%, ${effect.gradient[0]}, transparent 40%), radial-gradient(circle at 30% 40%, ${effect.gradient[1]}, transparent 45%)`,
              mixBlendMode: "screen",
              filter: "blur(24px)",
            }}
            transition={{ duration: effect.duration / 1000, ease: "easeOut" }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
