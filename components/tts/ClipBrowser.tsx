"use client";

import type { TtsClip } from "@/lib/tts/clip-store";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download, Trash2, ArrowUpRight, Library } from "lucide-react";

import { deleteTtsClip, downloadBlob, listTtsClips } from "@/lib/tts/clip-store";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type ClipBrowserProps = {
  /** When "inline", renders as a panel (no modal). When "modal", uses isOpen/onClose. */
  variant?: "modal" | "inline";
  isOpen?: boolean;
  onClose?: () => void;
  onLoadClip: (clip: TtsClip) => void;
  className?: string;
};

export function ClipBrowser({
  variant = "modal",
  isOpen = true,
  onClose,
  onLoadClip,
  className,
}: ClipBrowserProps) {
  const [clips, setClips] = useState<TtsClip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlRef = useRef<string | null>(null);
  const isInline = variant === "inline";

  const selected = useMemo(
    () => clips.find((c) => c.id === selectedId) ?? null,
    [clips, selectedId]
  );

  const selectedAudioUrl = useMemo(() => {
    if (!selected) return null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    urlRef.current = URL.createObjectURL(selected.audioBlob);

    return urlRef.current;
  }, [selected]);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await listTtsClips();

      setClips(items);
      if (!selectedId && items.length > 0) {
        setSelectedId(items[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clips");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInline) void refresh();
    else if (isOpen) void refresh();
  }, [isInline, isOpen]);

  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, []);

  const handleDelete = async (id: string) => {
    const nextId = selectedId === id ? (clips.find((c) => c.id !== id)?.id ?? null) : selectedId;

    await deleteTtsClip(id);
    await refresh();
    setSelectedId(nextId);
  };

  const content = (
    <div className={cn(isInline ? "h-full flex flex-col min-h-0" : "", className)}>
      <div
        className={`${glass()} rounded-3xl border border-white/10 overflow-hidden flex flex-col h-full min-h-0`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Library className="w-4.5 h-4.5 text-foreground/70" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground/80">Audio Library</div>
              <div className="text-xs text-muted-foreground/60">
                {clips.length} saved clip{clips.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {!isInline && onClose && (
            <button className="p-2 rounded-xl hover:bg-white/5 transition-colors" onClick={onClose}>
              <X className="w-4 h-4 text-foreground/70" />
            </button>
          )}
        </div>

        <div
          className={cn(
            "grid flex-1 min-h-0",
            isInline ? "grid-cols-1" : "grid-cols-1 md:grid-cols-[360px_1fr]"
          )}
        >
          {/* List */}
          <div
            className={cn(
              "border-white/[0.06] min-h-0 flex flex-col",
              isInline ? "border-b" : "border-b md:border-b-0 md:border-r"
            )}
          >
            <div className={cn("overflow-auto", isInline ? "flex-1 min-h-0" : "max-h-[60vh]")}>
              {isLoading ? (
                <div className="p-6 text-sm text-muted-foreground/60">Loading…</div>
              ) : error ? (
                <div className="p-6 text-sm text-red-400">{error}</div>
              ) : clips.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground/60">
                  No saved clips yet. Generate audio on the Speak page to populate this library.
                </div>
              ) : (
                <div className="p-2">
                  {clips.map((clip) => {
                    const active = clip.id === selectedId;

                    return (
                      <button
                        key={clip.id}
                        className={`
                                w-full text-left p-3 rounded-2xl transition-all
                                ${active ? "bg-white/[0.06] border border-white/[0.10]" : "hover:bg-white/[0.03]"}
                              `}
                        onClick={() => setSelectedId(clip.id)}
                      >
                        <div className="text-sm text-foreground/80 font-medium line-clamp-1">
                          {clip.title}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground/60">
                          <span>{clip.model}</span>
                          <span className="tabular-nums">
                            {new Date(clip.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="p-6">
            {!selected ? (
              <div className="text-sm text-muted-foreground/60">Select a clip to preview.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base font-medium text-foreground/90 line-clamp-2">
                      {selected.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground/60">
                      {selected.model} • {new Date(selected.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                      title="Download"
                      onClick={() =>
                        downloadBlob(selected.audioBlob, `speak-clip-${selected.createdAt}.mp3`)
                      }
                    >
                      <Download className="w-4 h-4 text-foreground/70" />
                    </button>
                    <button
                      className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                      title="Delete"
                      onClick={() => void handleDelete(selected.id)}
                    >
                      <Trash2 className="w-4 h-4 text-foreground/70" />
                    </button>
                  </div>
                </div>

                {selectedAudioUrl && (
                  <audio
                    controls
                    className={`${glass()} rounded-2xl p-2 w-full border border-white/10`}
                    src={selectedAudioUrl}
                  />
                )}

                <div className="flex items-center justify-between gap-3">
                  <button
                    className="flex-1 px-5 py-3 rounded-2xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    onClick={() => onLoadClip(selected)}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <ArrowUpRight className="w-4 h-4" />
                      Load into Speak
                    </span>
                  </button>
                </div>

                <div className="text-xs text-muted-foreground/60 leading-relaxed">
                  <div className="font-medium text-foreground/70 mb-1">Original text</div>
                  <div className="whitespace-pre-wrap line-clamp-6">{selected.originalText}</div>
                </div>
                {selected.enhancedText ? (
                  <div className="text-xs text-muted-foreground/60 leading-relaxed">
                    <div className="font-medium text-foreground/70 mb-1">Enhanced text</div>
                    <div className="whitespace-pre-wrap line-clamp-6">{selected.enhancedText}</div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isInline) return content;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[60]"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 top-6 md:top-10 mx-auto w-[min(1000px,calc(100%-2rem))]"
            exit={{ opacity: 0, y: 10 }}
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.35 }}
          >
            {content}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
