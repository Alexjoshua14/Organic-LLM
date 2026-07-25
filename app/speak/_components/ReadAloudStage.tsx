"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { Loader2, Play, Square, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { KaraokeCaption } from "./KaraokeCaption";

import { useTTS } from "@/hooks/use-tts";
import { chunkTextForSpeak } from "@/lib/speak/chunk-text";
import {
  estimateSpeakTokens,
  SPEAK_MAX_INPUT_TOKENS,
  validateSpeakInput,
} from "@/lib/speak/token-limit";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function ReadAloudStage({ onExit }: { onExit?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [text, setText] = useState("");
  const [chunkIndex, setChunkIndex] = useState(0);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const isPlayingAllRef = useRef(false);
  const streamAudioRef = useRef<
    ((args: { text: string; processText?: boolean }) => Promise<void>) | null
  >(null);

  const validation = useMemo(() => validateSpeakInput(text), [text]);
  const tokenEstimate = estimateSpeakTokens(text);

  const speech = useTTS({
    audioRef,
    autoplay: true,
    showNativeControls: false,
    onStatusChange: (status) => {
      if (status !== "complete" || !isPlayingAllRef.current) return;

      const next = chunkIndexRef.current + 1;

      if (next < chunksRef.current.length) {
        chunkIndexRef.current = next;
        setChunkIndex(next);
        void streamAudioRef.current?.({
          text: chunksRef.current[next] ?? "",
          processText: true,
        });
      } else {
        isPlayingAllRef.current = false;
        setIsPlayingAll(false);
        chunkIndexRef.current = 0;
        setChunkIndex(0);
      }
    },
  });

  streamAudioRef.current = speech.streamAudio;

  const alignment =
    speech.mergedAlignment?.normalizedAlignment ?? speech.mergedAlignment?.alignment ?? null;

  const handlePlay = useCallback(async () => {
    if (!validation.ok) return;

    const chunks = chunkTextForSpeak(text);

    if (chunks.length === 0) return;

    chunksRef.current = chunks;
    chunkIndexRef.current = 0;
    setChunkIndex(0);
    isPlayingAllRef.current = chunks.length > 1;
    setIsPlayingAll(chunks.length > 1);
    await speech.streamAudio({ text: chunks[0] ?? "", processText: true });
  }, [speech, text, validation.ok]);

  const handleStop = useCallback(() => {
    speech.stop();
    speech.close();
    isPlayingAllRef.current = false;
    setIsPlayingAll(false);
    chunkIndexRef.current = 0;
    setChunkIndex(0);
    chunksRef.current = [];
  }, [speech]);

  const isActive = speech.status === "playing" || speech.status === "processing";

  const displayText =
    isActive && chunksRef.current.length > 0
      ? chunksRef.current[chunkIndex] ?? text
      : text;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <audio ref={audioRef} className="hidden" />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <AnimatePresence mode="wait">
          {isActive ? (
            <motion.div
              key="playing"
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-3xl"
              exit={{ opacity: 0, y: 8 }}
              initial={{ opacity: 0, y: 12 }}
            >
              <KaraokeCaption
                activeIndices={speech.currentCharacterIndices}
                alignment={alignment}
                role="assistant"
                text={displayText}
              />
              {chunksRef.current.length > 1 ? (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Passage {chunkIndex + 1} of {chunksRef.current.length}
                </p>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="input"
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl space-y-4"
              exit={{ opacity: 0, y: -8 }}
              initial={{ opacity: 0, y: 8 }}
            >
              <div className="text-center space-y-2">
                <h2 className="font-commissioner text-2xl font-light text-foreground">
                  Read aloud
                </h2>
                <p className="text-sm text-muted-foreground">
                  Paste or write up to {SPEAK_MAX_INPUT_TOKENS.toLocaleString()} tokens — Organic
                  reads it back with live highlighting.
                </p>
              </div>

              <textarea
                className={cn(
                  glass({ opaque: true, border: "all" }),
                  "min-h-[200px] w-full resize-y rounded-2xl p-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30",
                  !validation.ok && "border-destructive/50"
                )}
                placeholder="Paste an article, script, notes, or any block of text…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  ~{tokenEstimate.toLocaleString()} / {SPEAK_MAX_INPUT_TOKENS.toLocaleString()}{" "}
                  tokens
                </span>
                {!validation.ok ? (
                  <span className="text-destructive">{validation.message}</span>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 flex items-center justify-center gap-3 border-t border-border/40 px-6 py-5">
        {isActive ? (
          <button
            className={cn(glass(), "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm")}
            type="button"
            onClick={handleStop}
          >
            <Square className="size-4" />
            Stop
          </button>
        ) : (
          <button
            className={cn(
              glass({ opaque: true, border: "all" }),
              "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-transform hover:scale-[1.02] disabled:opacity-50"
            )}
            disabled={!validation.ok || !text.trim() || speech.status === "processing"}
            type="button"
            onClick={() => void handlePlay()}
          >
            {speech.status === "processing" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Read aloud
          </button>
        )}

        {onExit ? (
          <button
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            type="button"
            onClick={onExit}
          >
            <Volume2 className="size-4" />
            Live voice
          </button>
        ) : null}
      </div>
    </div>
  );
}
