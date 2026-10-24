import type { Metadata } from "next";

import { GoodNewsList } from "./_components/GoodNewsList";
import { GoodNewsWelcome } from "./_components/GoodNewsWelcome";
import { formatDate } from "./_components/category-meta";

import Page from "@/components/layout/page";
import { getDigestForDate, getLatestDigest } from "@/data/supabase/good-news";
import { PREVIEW_DIGEST } from "@/lib/good-news/fixtures";

export const metadata: Metadata = {
  title: "Good News",
  description:
    "A daily, fully fact-checked digest of the top optimistic news — verified across multiple credible sources.",
};

// Digest is rebuilt once per day by a cron job; revalidate periodically.
export const revalidate = 600;

type SearchParams = Promise<{ preview?: string }>;

export default async function GoodNewsPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = (await searchParams) ?? {};
  // Dev-only preview: render a sample digest without DB/API keys.
  const isPreview = Boolean(params.preview); //&& process.env.NODE_ENV !== "production";

  const today = new Date().toISOString().slice(0, 10);
  const digest = isPreview
    ? PREVIEW_DIGEST
    : ((await getDigestForDate(today)) ?? (await getLatestDigest()));

  const hasItems = digest != null && digest.items.length > 0;
  const digestDateLabel = digest ? formatDate(digest.date) : null;
  const isStale = digest != null && digest.date !== today;

  // No digest yet: show the full-bleed welcome hero (its headline is the page's h1).
  if (!hasItems) {
    return (
      <Page>
        <div className="flex-1 w-full overflow-y-auto scroll-smooth grid place-items-center px-6 py-16">
          <GoodNewsWelcome />
        </div>
      </Page>
    );
  }

  return (
    <Page className="pt-5">
      <div className="flex-1 w-full overflow-y-auto scroll-smooth">
        <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-6 md:py-14">
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              Daily Digest
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Today&apos;s Good News
            </h1>
            <div className="mt-3 max-w-prose space-y-2 text-xs text-muted-foreground">
              <p className="text-sm leading-tight">Optimistic stories from the past week</p>
              <p className="text-sm leading-tight">
                Covering advances in medicine and science, climate and conservation wins, peace, and
                human progress
              </p>
              <p className="text-sm leading-tight">
                Every item is cross-checked against multiple credible sources before it appears here
              </p>
            </div>
            {digestDateLabel ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {isStale ? "Most recent digest · " : "Updated "}
                <time dateTime={digest!.date}>{digestDateLabel}</time>
              </p>
            ) : null}
          </header>

          {isPreview ? (
            <div
              role="note"
              className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200"
            >
              Preview mode: showing illustrative sample data, not a verified digest. Remove
              <code className="mx-1 rounded bg-foreground/10 px-1 py-0.5">?preview=1</code>
              to view the live digest.
            </div>
          ) : null}

          <main aria-label="Good news stories">
            <GoodNewsList items={digest!.items} />
          </main>

          <footer className="mt-10 border-t border-border/40 pt-5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Verification standard: a story is published only when it is reported by at least one
              high-trust source (e.g. Reuters, AP, Nature, WHO) or corroborated by two or more
              independent credible outlets, and an automated fact-check confirms the claim is
              supported by the underlying reporting. Speculation, forecasts, and opinion are
              excluded.
            </p>
          </footer>
        </div>
      </div>
    </Page>
  );
}
