"use client";

import { useEffect, useState } from "react";

import styles from "./blog-article.module.css";

type TocItem = { id: string; text: string };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * "On this page": the article's h2s, with the one being read marked. It reads the rendered
 * headings, so Markdown and TSX posts need no extra markup. Hidden by CSS until the page frame is
 * wide enough to hold it. A post with fewer than three sections gets no rail.
 */
export function BlogToc({ articleId }: { articleId: string }) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const root = document.getElementById(articleId);

    if (!root) return;

    const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>("h2"));
    const used = new Set<string>();
    const next = headings.map((h) => {
      const text = (h.textContent ?? "").trim();
      let id = h.id || slugify(text) || "section";

      while (used.has(id)) id = `${id}-2`;
      used.add(id);
      h.id = id;
      h.style.scrollMarginTop = "5rem";

      return { id, text };
    });

    setItems(next);

    if (headings.length === 0) return;

    // The heading nearest the top third of the screen is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);

        if (visible.length > 0) {
          setActiveId(
            visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0].target
              .id
          );
        }
      },
      { rootMargin: "0px 0px -66% 0px" }
    );

    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, [articleId]);

  if (items.length < 3) return null;

  return (
    <nav aria-label="On this page" className={styles.toc}>
      <span className={styles.tocLabel}>On this page</span>
      <ul className={styles.tocList}>
        {items.map((item) => (
          <li key={item.id}>
            <a
              aria-current={item.id === activeId ? "true" : undefined}
              className={`${styles.tocLink} organic-focus`}
              href={`#${item.id}`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
