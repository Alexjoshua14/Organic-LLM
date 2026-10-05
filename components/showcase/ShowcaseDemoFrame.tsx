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

const DEFAULT_DISCLOSURE = "Interactive preview with fictional data. No sign-in or live AI calls.";

export function ShowcaseDemoFrame({
  slug,
  title,
  value,
  disclosure = DEFAULT_DISCLOSURE,
  maxWidth = "6xl",
  children,
}: ShowcaseDemoFrameProps) {
  const { stop } = showcaseTourStop(slug);
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
          All demos
        </Link>
        <ShowcaseDemoHeader
          disclosure={disclosure}
          eyebrow={stop.title}
          title={title}
          value={value}
        />
        <div className="showcase-standalone-stage">{children}</div>
        <div className="showcase-demo-detail">
          <section>
            <h2>Try it yourself</h2>
            <p>{feature.tryThis}</p>
          </section>
          <section>
            <h2>Behind the interface</h2>
            <p>{feature.detail}</p>
          </section>
        </div>
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
      <ol>
        {SHOWCASE_TOUR.map((stop) => (
          <li key={stop.slug}>
            <Link aria-current={stop.slug === slug ? "page" : undefined} href={stop.href}>
              {stop.title}
            </Link>
          </li>
        ))}
      </ol>
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
