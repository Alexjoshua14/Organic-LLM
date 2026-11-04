import type { ReactNode } from "react";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  SHOWCASE_TOUR,
  showcaseTourStop,
  type ShowcaseTourSlug,
} from "@/lib/showcase/feature-tour";
import { FEATURE_PRESENTATIONS } from "@/lib/showcase/feature-presentations";
import { cn } from "@/lib/utils";

type ShowcaseDemoFrameProps = {
  slug: ShowcaseTourSlug;
  title: string;
  value: string;
  disclosure?: string;
  maxWidth?: "5xl" | "6xl" | "7xl";
  children: ReactNode;
};

const DEFAULT_DISCLOSURE = "Scripted demo · fictional data";

export function ShowcaseDemoFrame({
  slug,
  title,
  value,
  disclosure = DEFAULT_DISCLOSURE,
  maxWidth = "6xl",
  children,
}: ShowcaseDemoFrameProps) {
  const { stop, index } = showcaseTourStop(slug);
  const feature = FEATURE_PRESENTATIONS[slug];

  return (
    <div className="showcase-scroll">
      <div
        className={cn(
          "showcase-container showcase-demo-page",
          maxWidth === "5xl" && "max-w-5xl",
          maxWidth === "6xl" && "max-w-6xl"
        )}
      >
        <Link className="showcase-demo-back" href="/showcase">
          <ArrowLeft aria-hidden size={15} />
          Back to showcase
        </Link>
        <ShowcaseDemoHeader
          disclosure={disclosure}
          eyebrow={`${stop.facet} · ${index + 1} of ${SHOWCASE_TOUR.length}`}
          title={title}
          value={value}
        />
        <div className="showcase-standalone-stage">{children}</div>
        <p className="showcase-demo-detail">
          <strong>Behind the interface.</strong> {feature.detail}
        </p>
        <ShowcaseTourFooter slug={slug} />
      </div>
    </div>
  );
}

export function ShowcaseDemoHeader({
  title,
  value,
  eyebrow,
  disclosure = DEFAULT_DISCLOSURE,
  className,
}: {
  title: string;
  value: string;
  eyebrow?: string;
  disclosure?: string;
  className?: string;
}) {
  return (
    <header className={cn("showcase-demo-header", className)}>
      {eyebrow ? <p>{eyebrow}</p> : null}
      <h1>{title}</h1>
      <p className="showcase-demo-value">{value}</p>
      <p className="showcase-demo-disclosure">{disclosure}</p>
    </header>
  );
}

export function ShowcaseTourFooter({ slug }: { slug: ShowcaseTourSlug }) {
  const { previous, next } = showcaseTourStop(slug);

  return (
    <nav aria-label="Showcase tour" className="showcase-tour-footer">
      <div className="showcase-tour-neighbors">
        <Link className="inline-flex items-center gap-2" href={previous?.href ?? "/showcase"}>
          <ArrowLeft aria-hidden size={15} />
          {previous?.title ?? "All demos"}
        </Link>
        <Link className="inline-flex items-center gap-2" href={next?.href ?? "/showcase"}>
          {next ? `Next: ${next.title}` : "Back to all demos"}
          <ArrowRight aria-hidden size={15} />
        </Link>
      </div>
    </nav>
  );
}
