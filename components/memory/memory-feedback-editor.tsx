"use client";

import type {
  FeedbackDraftInput,
  FeedbackDraftResult,
  MemoryFeedbackRow,
} from "@/lib/schemas/memory-quality";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import {
  actionApproveFeedbackNote,
  actionRemoveFeedbackNote,
  actionRemoveMemoryFeedback,
  actionPreviewFeedbackMemory,
  actionShareFeedbackMemory,
  actionRemoveSharedFeedbackMemory,
} from "@/app/actions/memory-feedback";
import { Button } from "@/components/third-party/ui/button";

export const FEEDBACK_CHANGED_EVENT = "memory-feedback-changed";

export function announceFeedbackChange() {
  window.dispatchEvent(new Event(FEEDBACK_CHANGED_EVENT));
}

export function MemoryFeedbackEditor({
  row,
  onSaved,
  onClose,
}: {
  row: MemoryFeedbackRow;
  onSaved: (row: MemoryFeedbackRow | null) => void;
  onClose: () => void;
}) {
  const [engaged, setEngaged] = useState(Boolean(row.note));
  const [messages, setMessages] = useState<FeedbackDraftInput["messages"]>([]);
  const [input, setInput] = useState("");
  const [proposal, setProposal] = useState<string | null>(null);
  const [memoryPreview, setMemoryPreview] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const memoryReviewRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const mutation = { feedbackId: row.id, memoryId: row.memory_id, revision: row.revision };
  const busy = pending || drafting;
  const showingProposal = proposal !== null;

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (engaged && !showingProposal && !row.note) inputRef.current?.focus();
  }, [engaged, showingProposal, row.note]);
  useEffect(() => {
    if (!showingProposal) return;
    noteRef.current?.focus({ preventScroll: true });
    reviewRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [showingProposal]);
  useEffect(() => {
    if (memoryPreview === null) return;
    memoryReviewRef.current?.focus({ preventScroll: true });
    memoryReviewRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [memoryPreview]);

  async function send() {
    if (!input.trim() || busy) return;
    const conversation: FeedbackDraftInput["messages"] = [
      ...messages,
      { role: "user" as const, content: input.trim() },
    ].slice(-19);
    const controller = new AbortController();

    abort.current = controller;
    setError(null);
    setDrafting(true);
    try {
      const response = await fetch("/api/memory/feedback/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...mutation, messages: conversation }),
        signal: controller.signal,
        cache: "no-store",
      });
      const data = (await response.json()) as FeedbackDraftResult & { error?: string };

      if (!response.ok) throw new Error(data.error ?? "Could not draft a note.");
      if (controller.signal.aborted) return;
      setMessages([
        ...conversation,
        {
          role: "assistant",
          content: `${data.reply}${data.summary ? `\n\nProposed note: ${data.summary}` : ""}`.slice(
            0,
            3000
          ),
        },
      ]);
      setInput("");
      setProposal(data.summary);
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(caught instanceof Error ? caught.message : "Could not draft a note.");
    } finally {
      if (!controller.signal.aborted) setDrafting(false);
    }
  }

  function saveNote() {
    if (!proposal?.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await actionApproveFeedbackNote({
          ...mutation,
          note: proposal,
          approved: true,
        });

        if (result.error || !result.data) {
          setError(result.error ?? "Could not save note.");

          return;
        }
        onSaved(result.data);
        announceFeedbackChange();
      } catch {
        setError("Could not save note. Please try again.");
      }
    });
  }

  function remove(noteOnly: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        if (noteOnly) {
          const result = await actionRemoveFeedbackNote(mutation);

          if (result.error || !result.data) {
            setError(result.error ?? "Could not remove note.");

            return;
          }
          onSaved(result.data);
        } else {
          const result = await actionRemoveMemoryFeedback(mutation);

          if (result.error) {
            setError(result.error);

            return;
          }
          onSaved(null);
          onClose();
        }
        announceFeedbackChange();
      } catch {
        setError("Could not remove feedback. Please try again.");
      }
    });
  }

  function previewMemory() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await actionPreviewFeedbackMemory(mutation);

        if (result.error || !result.data) {
          setError(result.error ?? "Could not load this memory.");

          return;
        }
        setMemoryPreview(result.data.memoryText);
      } catch {
        setError("Could not load this memory. Please try again.");
      }
    });
  }

  function saveSharedMemory(removeCopy = false) {
    if (!removeCopy && memoryPreview === null) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = removeCopy
          ? await actionRemoveSharedFeedbackMemory(mutation)
          : await actionShareFeedbackMemory({
              ...mutation,
              memoryText: memoryPreview!,
              approved: true,
            });

        if (result.error || !result.data) {
          setError(result.error ?? "Could not update the shared memory.");
          // A changed memory must be previewed again, never shared through a stale retry.
          setMemoryPreview(null);

          return;
        }
        setMemoryPreview(null);
        onSaved(result.data);
        announceFeedbackChange();
      } catch {
        setError("Could not update the shared memory. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">{row.note ? "Your shared note" : "Vote saved"}</p>
      {!engaged ? (
        <>
          <p className="text-muted-foreground">
            Want to explain what {row.signal === "up" ? "worked" : "went wrong"}? A note is
            optional.
          </p>
          <Button size="sm" variant="outline" onClick={() => setEngaged(true)}>
            Add a note
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The AI assistant can use this memory, related memories, and chat context. The note you
            approve is shared with the admin of Organic LLM for product improvement. Sharing the
            memory itself is a separate choice below. This discussion isn’t saved.
          </p>
          {row.note && proposal === null && messages.length === 0 && (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{row.note}</p>
              <div className="flex gap-2">
                <Button
                  disabled={busy}
                  size="sm"
                  variant="outline"
                  onClick={() => setProposal(row.note)}
                >
                  Edit note
                </Button>
                <Button disabled={busy} size="sm" variant="ghost" onClick={() => remove(true)}>
                  Remove note
                </Button>
              </div>
            </div>
          )}
          {messages.length > 0 && (
            <div
              aria-label="Feedback discussion"
              className="max-h-40 space-y-3 overflow-y-auto"
              role="log"
            >
              {messages.map((message, index) => (
                <p key={index} className="whitespace-pre-wrap text-xs leading-relaxed">
                  <span className="font-medium">
                    {message.role === "user" ? "You" : "Assistant"}:{" "}
                  </span>
                  {message.content.split("\n\nProposed note:")[0]}
                </p>
              ))}
            </div>
          )}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="text-xs text-muted-foreground" htmlFor={`${id}-input`}>
              {messages.length
                ? "Tell the assistant more"
                : "What made this memory helpful or unhelpful?"}
            </label>
            <textarea
              ref={inputRef}
              className="min-h-20 w-full resize-y rounded-lg border border-border bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              disabled={busy}
              id={`${id}-input`}
              maxLength={3000}
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={busy || !input.trim()} size="sm" type="submit" variant="outline">
                {drafting && (
                  <Loader2
                    aria-hidden
                    className="size-3.5 animate-spin motion-reduce:animate-none"
                  />
                )}
                {drafting ? "Drafting…" : "Send"}
              </Button>
              {proposal === null && (
                <Button
                  disabled={busy}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => setProposal(row.note ?? "")}
                >
                  Write a note yourself
                </Button>
              )}
            </div>
          </form>
          {proposal !== null && (
            <div ref={reviewRef} className="space-y-2 border-t border-border pt-3">
              <label className="font-medium text-xs" htmlFor={`${id}-note`}>
                Review the note to share
              </label>
              <textarea
                ref={noteRef}
                className="min-h-24 w-full resize-y rounded-lg border border-border bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                disabled={busy}
                id={`${id}-note`}
                maxLength={2000}
                rows={4}
                value={proposal}
                onChange={(event) => setProposal(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                You can edit this text before approving, and edit or remove it later.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !proposal.trim()} size="sm" onClick={saveNote}>
                  {pending ? "Saving…" : "Approve & share note"}
                </Button>
                <Button
                  disabled={busy}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setProposal(null);
                    inputRef.current?.focus();
                  }}
                >
                  Refine instead
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      <section aria-label="Share memory content" className="space-y-2 border-t border-border pt-3">
        {row.shared_memory !== null ? (
          <>
            <p className="text-xs font-medium">Memory shared with Organic LLM’s admin</p>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs">
              {row.shared_memory}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This is the copy you shared. It stays with your feedback until you remove it, even if
              you edit or delete the original memory.
            </p>
            <Button
              disabled={busy}
              size="sm"
              variant="outline"
              onClick={() => saveSharedMemory(true)}
            >
              Remove shared memory
            </Button>
          </>
        ) : memoryPreview !== null ? (
          <div
            ref={memoryReviewRef}
            aria-labelledby={`${id}-memory-title`}
            className="space-y-2 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
            role="group"
            tabIndex={-1}
          >
            <p className="text-xs font-medium" id={`${id}-memory-title`}>
              Review the memory to share
            </p>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 text-xs">
              {memoryPreview}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              This exact memory content will be shared with the admin of Organic LLM for product
              improvement. The copy stays with your feedback even if you delete the original. You
              can remove the shared copy at any time.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} size="sm" onClick={() => saveSharedMemory()}>
                Share memory with admin
              </Button>
              <Button
                disabled={busy}
                size="sm"
                variant="ghost"
                onClick={() => setMemoryPreview(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Optionally share a copy of this memory with the admin of Organic LLM alongside your
              feedback. You’ll review its content first.
            </p>
            <Button disabled={busy} size="sm" variant="outline" onClick={previewMemory}>
              {pending ? "Loading…" : "Share memory too…"}
            </Button>
          </>
        )}
      </section>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <Button disabled={pending} size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          className="text-muted-foreground"
          disabled={busy}
          size="sm"
          variant="ghost"
          onClick={() => remove(false)}
        >
          Remove feedback
        </Button>
      </div>
    </div>
  );
}
