import Link from "next/link";

import Page from "@/components/layout/page";
import { getPrototypeHref, prototypes } from "./_config/prototypes";

export default function PrototypesGalleryPage() {
  return (
    <Page>
      <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:px-8 sm:py-16">
        {/* Breadcrumb */}
        <nav className="mb-12 sm:mb-16">
          <Link
            href="/sandbox"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Sandbox
          </Link>
        </nav>

        {/* Header — clear hierarchy, one idea per line */}
        <header className="mb-14 sm:mb-20">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Prototypes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            UI and background experiments. Toggle light/dark in the top-right to
            compare where it applies.
          </p>
        </header>

        {/* Gallery — catalog list: number, title, description, link */}
        <ul className="space-y-0">
          {prototypes.map((p, i) => (
            <li key={p.slug}>
              <Link
                href={getPrototypeHref(p.slug)}
                className="group block border-b border-border py-6 transition-colors first:pt-0 last:border-b-0 hover:bg-muted/30 sm:py-8"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums sm:w-8">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium text-foreground group-hover:text-foreground/90">
                      {p.title}
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  </div>
                  <span
                    className="mt-2 text-xs text-muted-foreground sm:mt-0 sm:shrink-0"
                    aria-hidden
                  >
                    →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* Footer note */}
        <p className="mt-14 text-center text-xs text-muted-foreground sm:mt-20">
          More entries as we tag stable releases.
        </p>
      </div>
    </Page>
  );
}
