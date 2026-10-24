"use client";

import { useEffect, useState, type RefObject } from "react";

type UseWelcomeInViewOptions = {
  threshold?: number;
  rootMargin?: string;
};

/**
 * Gates welcome illustration loops and carousels until the element is on screen.
 */
export function useWelcomeInView(
  ref: RefObject<Element | null>,
  { threshold = 0.25, rootMargin }: UseWelcomeInViewOptions = {}
) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold,
      rootMargin,
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [ref, rootMargin, threshold]);

  return inView;
}
