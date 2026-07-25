"use client";

import { AlertTriangle, BookOpen, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { DmzIntelligenceTransfer } from "@/components/sandbox/DmzIntelligenceTransfer";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { getPrototypeBySlug } from "@/app/sandbox/prototypes/_config/prototypes";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { cn } from "@/lib/utils";

export function PrototypeAboutPanel({ slug }: { slug: string }) {
  const prototype = getPrototypeBySlug(slug);
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);

  const needsAdminInput = Boolean(prototype?.about.adminQuestion && !prototype?.about.authorThoughts);

  const dmzQuestion = useMemo(() => {
    if (!prototype) return "";

    if (prototype.about.adminQuestion) {
      return prototype.about.adminQuestion;
    }

    return `What are my design notes and intentions for "${prototype.title}"? Summarize what it is, why it exists, and how someone should read this prototype.`;
  }, [prototype]);

  const dmzContext = useMemo(() => {
    if (!prototype) return "";

    const parts = [
      prototype.about.what,
      prototype.description,
      prototype.about.authorThoughts,
      prototype.about.howToUse,
    ].filter(Boolean);

    return parts.join("\n\n");
  }, [prototype]);

  if (!prototype) return null;

  const questionFirst = isAdmin && needsAdminInput;

  return (
    <>
      <div className="pointer-events-none fixed right-4 top-20 z-40 flex flex-col items-end gap-2 sm:right-6">
        {isAdmin && needsAdminInput ? (
          <button
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200 shadow-sm backdrop-blur-md"
            type="button"
            onClick={() => setOpen(true)}
          >
            <AlertTriangle className="size-3.5" />
            Needs your input
          </button>
        ) : null}

        <button
          className={cn(
            "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-muted/50",
            isAdmin && needsAdminInput && "border-amber-400/30"
          )}
          type="button"
          onClick={() => setOpen(true)}
        >
          <BookOpen className="size-3.5 text-muted-foreground" />
          What is this?
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {questionFirst ? (
            <>
              <DialogHeader className="space-y-3 text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {prototype.title}
                </p>
                <DialogTitle className="text-xl font-semibold leading-snug sm:text-2xl">
                  {dmzQuestion}
                </DialogTitle>
              </DialogHeader>

              <DmzIntelligenceTransfer
                context={dmzContext}
                question={dmzQuestion}
                slug={slug}
                subjectTitle={prototype.title}
              />

              {prototype.about.what ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{prototype.about.what}</p>
              ) : null}
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{prototype.title}</DialogTitle>
                <p className="text-sm text-muted-foreground">{prototype.about.what}</p>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {prototype.about.authorThoughts ? (
                  <section className="space-y-1">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Design intent
                    </h3>
                    <p className="leading-relaxed text-foreground">{prototype.about.authorThoughts}</p>
                  </section>
                ) : null}

                {prototype.about.howToUse ? (
                  <section className="space-y-1">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      How to use
                    </h3>
                    <p className="leading-relaxed text-muted-foreground">{prototype.about.howToUse}</p>
                  </section>
                ) : null}
              </div>

              <DmzIntelligenceTransfer
                context={dmzContext}
                question={dmzQuestion}
                slug={slug}
                subjectTitle={prototype.title}
              />
            </>
          )}

          <DialogFooter>
            <a
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              href="/sandbox/prototypes"
            >
              <ExternalLink className="size-3.5" />
              All prototypes
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
