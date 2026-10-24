"use client";

import { AlertTriangle, BookOpen, ExternalLink, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

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
import {
  dismissPrototypeAboutChip,
  isPrototypeAboutChipDismissed,
  readPrototypeAboutDismissRecord,
  type PrototypeAboutChipId,
  type PrototypeAboutDismissRecord,
} from "@/lib/sandbox/prototype-about-dismiss-storage";
import { cn } from "@/lib/utils";

function readInitialDismissRecord(): PrototypeAboutDismissRecord {
  if (typeof window === "undefined") return {};

  return readPrototypeAboutDismissRecord(window.localStorage);
}

export function PrototypeAboutPanel({ slug }: { slug: string }) {
  const prototype = getPrototypeBySlug(slug);
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [dismissRecord, setDismissRecord] = useState(readInitialDismissRecord);

  const needsAdminInput = Boolean(
    prototype?.about.adminQuestion && !prototype?.about.authorThoughts
  );
  const needsInputDismissed = isPrototypeAboutChipDismissed(dismissRecord, "needs-input");
  const whatIsThisDismissed = isPrototypeAboutChipDismissed(dismissRecord, "what-is-this");

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
  const showNeedsInput = isAdmin && needsAdminInput && !needsInputDismissed;
  const showWhatIsThis = !whatIsThisDismissed;

  if (!showNeedsInput && !showWhatIsThis && !open) return null;

  function dismissChip(id: PrototypeAboutChipId) {
    setDismissRecord(dismissPrototypeAboutChip(window.localStorage, id));
  }

  return (
    <>
      {showNeedsInput || showWhatIsThis ? (
        <div className="pointer-events-none fixed right-4 top-20 z-40 flex flex-col items-end gap-2 sm:right-6">
          {showNeedsInput ? (
            <DismissibleAboutChip
              accent="amber"
              icon={<AlertTriangle className="size-3.5" />}
              label="Needs your input"
              openLabel="Open needs your input"
              dismissLabel="Dismiss needs your input"
              onOpen={() => setOpen(true)}
              onDismiss={() => dismissChip("needs-input")}
            />
          ) : null}

          {showWhatIsThis ? (
            <DismissibleAboutChip
              accent={showNeedsInput ? "amber-soft" : "default"}
              icon={<BookOpen className="size-3.5 text-muted-foreground" />}
              label="What is this?"
              openLabel="Open what is this"
              dismissLabel="Dismiss what is this"
              onOpen={() => setOpen(true)}
              onDismiss={() => dismissChip("what-is-this")}
            />
          ) : null}
        </div>
      ) : null}

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
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {prototype.about.what}
                </p>
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
                    <p className="leading-relaxed text-foreground">
                      {prototype.about.authorThoughts}
                    </p>
                  </section>
                ) : null}

                {prototype.about.howToUse ? (
                  <section className="space-y-1">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      How to use
                    </h3>
                    <p className="leading-relaxed text-muted-foreground">
                      {prototype.about.howToUse}
                    </p>
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

type DismissibleAboutChipProps = {
  accent: "amber" | "amber-soft" | "default";
  icon: ReactNode;
  label: string;
  openLabel: string;
  dismissLabel: string;
  onOpen: () => void;
  onDismiss: () => void;
};

function DismissibleAboutChip({
  accent,
  icon,
  label,
  openLabel,
  dismissLabel,
  onOpen,
  onDismiss,
}: DismissibleAboutChipProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto inline-flex h-8 items-stretch overflow-hidden rounded-full border shadow-sm backdrop-blur-md",
        accent === "amber" && "border-amber-400/40 bg-amber-400/15 text-amber-200",
        accent === "amber-soft" && "border-amber-400/30 bg-background/70 text-foreground",
        accent === "default" && "border-border/60 bg-background/70 text-foreground"
      )}
    >
      <button
        aria-label={openLabel}
        className={cn(
          "inline-flex min-w-0 flex-1 items-center gap-1.5 px-3 text-xs transition-colors",
          accent === "amber" ? "font-medium" : "hover:bg-muted/50"
        )}
        type="button"
        onClick={onOpen}
      >
        {icon}
        {label}
      </button>
      <button
        aria-label={dismissLabel}
        className={cn(
          "grid w-8 shrink-0 place-items-center border-l transition-colors",
          accent === "amber"
            ? "border-amber-400/30 text-amber-200/80 hover:bg-amber-400/20 hover:text-amber-100"
            : "border-border/40 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
        )}
        type="button"
        onClick={onDismiss}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
