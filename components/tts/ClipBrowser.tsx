"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Download, Trash2, ArrowUpRight, Library } from "lucide-react";

import type { TtsClip } from "@/lib/tts/clip-store";
import { deleteTtsClip, downloadBlob, listTtsClips } from "@/lib/tts/clip-store";
import { glass } from "@/components/design-system/primitives";

type ClipBrowserProps = {
  isOpen: boolean;
  onClose: () => void;
  onLoadClip: (clip: TtsClip) => void;
};

export function ClipBrowser({ isOpen, onClose, onLoadClip }: ClipBrowserProps) {
  const [clips, setClips] = useState<TtsClip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlRef = useRef<string | null>(null);

  const selected = useMemo(
    () => clips.find((c) => c.id === selectedId) ?? null,
    [clips, selectedId],
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
    if (!isOpen) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, []);

  const handleDelete = async (id: string) => {
    const nextId =
      selectedId === id ? (clips.find((c) => c.id !== id)?.id ?? null) : selectedId;
    await deleteTtsClip(id);
    await refresh();
    setSelectedId(nextId);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />

          <motion.div
            className="absolute inset-x-0 top-6 md:top-10 mx-auto w-[min(1000px,calc(100%-2rem))]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.35 }}
          >
            <div className={`${glass()} rounded-3xl border border-white/10 overflow-hidden`}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
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

                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4 text-foreground/70" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
                {/* List */}
                <div className="border-b md:border-b-0 md:border-r border-white/[0.06]">
                  <div className="max-h-[60vh] overflow-auto">
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
                              onClick={() => setSelectedId(clip.id)}
                              className={`
                                w-full text-left p-3 rounded-2xl transition-all
                                ${active ? "bg-white/[0.06] border border-white/[0.10]" : "hover:bg-white/[0.03]"}
                              `}
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
                            onClick={() =>
                              downloadBlob(selected.audioBlob, `prometheus-${selected.createdAt}.mp3`)
                            }
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-foreground/70" />
                          </button>
                          <button
                            onClick={() => void handleDelete(selected.id)}
                            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                            title="Delete"
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
                          onClick={() => onLoadClip(selected)}
                          className={`
                            flex-1 px-5 py-3 rounded-2xl text-sm font-medium
                            bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white
                            shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30
                            hover:scale-[1.01] transition-all duration-300
                          `}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

