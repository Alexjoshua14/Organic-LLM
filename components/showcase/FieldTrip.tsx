"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ShowcaseStage } from "./ShowcaseStage";
import { ShowcasePlaybackProvider } from "./replay/showcase-playback-context";

import { FIELD_TRIP } from "@/lib/showcase/field-trip";
import { SHOWCASE_TOUR } from "@/lib/showcase/feature-tour";
import { cn } from "@/lib/utils";

const ACTIVE_BAND = "-45% 0px -50% 0px";
const MOUNT_AHEAD = "900px 0px";

/** Mount a chapter's demo shortly before it scrolls into view, and keep it mounted. */
function useMountAhead() {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node || mounted) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setMounted(true);
      },
      { rootMargin: MOUNT_AHEAD }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [mounted]);

  return { ref, mounted };
}

function Chapter({ index }: { index: number }) {
  const chapter = FIELD_TRIP[index]!;
  const stop = SHOWCASE_TOUR.find((s) => s.slug === chapter.slug)!;
  const { ref, mounted } = useMountAhead();
  const titleId = `trip-${chapter.slug}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className="showcase-chapter"
      data-chapter={chapter.slug}
      id={`trip-${chapter.slug}`}
    >
      <header className="showcase-chapter-intro">
        <p className="showcase-chapter-when">
          <span>{String(index + 1).padStart(2, "0")}</span>
          {chapter.when}
        </p>
        <h2 id={titleId}>{chapter.headline}</h2>
        <div className="showcase-chapter-copy">
          <p>{chapter.narration}</p>
          <Link className="showcase-text-link" href={stop.href}>
            Open the full {stop.title} demo <ArrowUpRight aria-hidden size={15} />
          </Link>
        </div>
      </header>
      <div ref={ref} className="showcase-chapter-stage">
        {mounted ? (
          <ShowcaseStage slug={chapter.slug} />
        ) : (
          <div className="showcase-demo-loading" />
        )}
      </div>
    </section>
  );
}

export function FieldTrip() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const sections = FIELD_TRIP.map((c) => document.getElementById(`trip-${c.slug}`));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = FIELD_TRIP.findIndex((c) => `trip-${c.slug}` === entry.target.id);

          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: ACTIVE_BAND }
    );

    sections.forEach((s) => s && observer.observe(s));

    return () => observer.disconnect();
  }, []);

  return (
    <ShowcasePlaybackProvider mode="narrated">
      <div className="showcase-trip" id="demos">
        <nav aria-label="Field trip chapters" className="showcase-trip-bar">
          <ol>
            {FIELD_TRIP.map((chapter, index) => (
              <li key={chapter.slug}>
                <a
                  aria-current={active === index ? "step" : undefined}
                  className={cn(active === index && "is-active")}
                  href={`#trip-${chapter.slug}`}
                >
                  <span>{index + 1}</span>
                  {chapter.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {FIELD_TRIP.map((chapter, index) => (
          <Chapter key={chapter.slug} index={index} />
        ))}
      </div>
    </ShowcasePlaybackProvider>
  );
}
