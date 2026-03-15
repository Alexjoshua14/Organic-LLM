"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface ScrollOutDisappearProps {
  scrollContainerRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

export function ScrollOutDisappear({
  scrollContainerRef,
  children,
}: ScrollOutDisappearProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hasScrolledOut, setHasScrolledOut] = useState(false);

  useEffect(() => {
    const root = scrollContainerRef.current;
    const target = cardRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting) setHasScrolledOut(true);
      },
      { root, rootMargin: "0px", threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [scrollContainerRef]);

  return (
    <motion.div
      ref={cardRef}
      className="h-full"
      initial={false}
      animate={{
        opacity: hasScrolledOut ? 0 : 1,
        scale: hasScrolledOut ? 0.98 : 1,
        filter: hasScrolledOut ? "blur(4px)" : "blur(0px)",
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
