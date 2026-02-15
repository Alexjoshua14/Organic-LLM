"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@heroui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Loader2,
  Download,
  Play,
  Pause,
  X,
  Edit3,
  Sparkles,
  Check,
  RefreshCw,
  ChevronRight,
  Clock,
  Wand2,
  Layers,
  SplitSquareHorizontal,
  FileText,
  Maximize2,
  Minimize2,
  Pin,
  Trash2,
} from "lucide-react";

import Page from "@/components/layout/page";
import { createLogger } from "@/lib/logger";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { SpeechModelSelector } from "@/components/chat/speech-model-selector";
import { SegmentManager, TextSegment, SegmentStatus } from "@/components/tts/SegmentManager";
import { GenerationProgress } from "@/components/tts/GenerationProgress";
import { UnifiedPlayback } from "@/components/tts/UnifiedPlayback";
import { TTSModel, splitTextIntoSegments, calculateTokenUsage, formatCost, formatDuration, formatAudioDuration } from "@/lib/tts/token-calculator";
import { ClipBrowser } from "@/components/tts/ClipBrowser";
import { makeClipTitle, saveTtsClip, type TtsClip } from "@/lib/tts/clip-store";
import {
  listPinnedForSpeak,
  removePinnedForSpeak,
  type PinnedForSpeak,
} from "@/lib/tts/pinned-to-speak";

const logger = createLogger("app/speak/page.tsx");

type DisplayMode =
  | "input"
  | "review"
  | "segments"
  | "transforming"
  | "generating"
  | "playback";
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function SpeakPage() {
  // Core state
  const [inputText, setInputText] = useState("");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("input");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [processText, setProcessText] = useState(true);
  const [selectedModel, setSelectedModel] = useState<TTSModel>("eleven_flash_v2_5");
  const [error, setError] = useState<string | null>(null);

  // Enhanced-text review state (separate from segmentation)
  const [enhancedText, setEnhancedText] = useState<string>("");
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Pinned from chat (load into input)
  const [pinnedList, setPinnedList] = useState<PinnedForSpeak[]>([]);

  // Input expansion state
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Segmentation state
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [isSegmented, setIsSegmented] = useState(false);

  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [currentGeneratingId, setCurrentGeneratingId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [estimatedDurationMs, setEstimatedDurationMs] = useState(0);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);

  // Keyboard shortcut for fullscreen toggle (Ctrl+E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        if (displayMode === "input") {
          setIsFullscreen((prev) => !prev);
          // Focus textarea when entering fullscreen
          if (!isFullscreen) {
            setTimeout(() => textareaRef.current?.focus(), 100);
          }
        }
      }
      // Escape to exit fullscreen
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayMode, isFullscreen]);

  // Auto-expand when user scrolls within textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleScroll = () => {
      if (isInputFocused && textarea.scrollTop > 0) {
        setIsInputExpanded(true);
      }
    };

    textarea.addEventListener("scroll", handleScroll);
    return () => textarea.removeEventListener("scroll", handleScroll);
  }, [isInputFocused]);

  // Collapse when focus leaves and scroll is at top
  useEffect(() => {
    if (!isInputFocused && textareaRef.current?.scrollTop === 0) {
      setIsInputExpanded(false);
    }
  }, [isInputFocused]);

  // Load pinned-from-chat list when on Speak page (input mode)
  const refreshPinnedList = useCallback(async () => {
    try {
      const list = await listPinnedForSpeak();
      setPinnedList(list);
    } catch {
      setPinnedList([]);
    }
  }, []);

  useEffect(() => {
    if (displayMode === "input") {
      void refreshPinnedList();
    }
  }, [displayMode, refreshPinnedList]);

  const handleLoadPinned = useCallback(
    (item: PinnedForSpeak) => {
      setInputText(item.content);
      setDisplayMode("input");
      setError(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    },
    [],
  );

  const handleRemovePinned = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await removePinnedForSpeak(id);
      await refreshPinnedList();
    },
    [refreshPinnedList],
  );

  // Calculate estimates for current input
  const inputEstimates = useMemo(() => {
    if (!inputText.trim()) return null;
    return calculateTokenUsage(inputText, selectedModel);
  }, [inputText, selectedModel]);

  // Create segments from text
  const handleSegmentText = useCallback(() => {
    const textSegments = splitTextIntoSegments(inputText, "paragraph");
    const newSegments: TextSegment[] = textSegments.map((text, idx) => ({
      id: `segment-${Date.now()}-${idx}`,
      index: idx,
      originalText: text,
      processedText: null,
      status: "pending",
      audioData: null,
      audioUrl: null,
      generationStatus: "generate",
    }));
    setSegments(newSegments);
    setIsSegmented(true);
    setDisplayMode("segments");
  }, [inputText]);

  const revokeSegmentUrls = useCallback((segs: TextSegment[]) => {
    for (const s of segs) {
      if (s.audioUrl) {
        try {
          URL.revokeObjectURL(s.audioUrl);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // Transform-only: review enhanced text before generating (as a whole or as segments)
  const handleReviewEnhancedText = useCallback(async () => {
    if (!inputText.trim()) {
      setError("Please enter some text");
      return;
    }

    setError(null);
    setIsEnhancing(true);
    setEnhancedText("");
    setDisplayMode("review");

    try {
      const res = await fetch("/api/ai/tts/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || "Transform failed");
      }

      const data = await res.json();
      setEnhancedText(String(data.transformedText ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transform failed");
      setDisplayMode("input");
    } finally {
      setIsEnhancing(false);
    }
  }, [inputText]);

  const handleGenerateEnhancedWhole = useCallback(async () => {
    const text = (enhancedText || "").trim();
    if (!text) {
      setError("Enhanced text is empty");
      return;
    }

    const segment: TextSegment = {
      id: `segment-${Date.now()}-0`,
      index: 0,
      originalText: inputText,
      processedText: enhancedText,
      status: "pending",
      audioData: null,
      audioUrl: null,
      generationStatus: "generate",
    };

    revokeSegmentUrls(segments);
    setSegments([segment]);
    setIsSegmented(false);
    await generateSegment(segment.id, [segment]);
  }, [enhancedText, inputText, revokeSegmentUrls, segments]);

  const handleSplitEnhancedText = useCallback(() => {
    const text = (enhancedText || "").trim();
    if (!text) {
      setError("Enhanced text is empty");
      return;
    }
    const textSegments = splitTextIntoSegments(text, "paragraph");
    const newSegments: TextSegment[] = textSegments.map((t, idx) => ({
      id: `segment-${Date.now()}-${idx}`,
      index: idx,
      originalText: t,
      processedText: t, // already enhanced; skip per-segment transform
      status: "pending",
      audioData: null,
      audioUrl: null,
      generationStatus: "generate",
    }));
    revokeSegmentUrls(segments);
    setSegments(newSegments);
    setIsSegmented(true);
    setDisplayMode("segments");
  }, [enhancedText, revokeSegmentUrls, segments]);

  const handleLoadClip = useCallback(
    (clip: TtsClip) => {
      const url = URL.createObjectURL(clip.audioBlob);
      const segment: TextSegment = {
        id: `segment-${Date.now()}-0`,
        index: 0,
        originalText: clip.originalText,
        processedText: clip.enhancedText,
        status: "generated",
        audioData: null,
        audioUrl: url,
        generationStatus: "generate",
      };

      revokeSegmentUrls(segments);
      setInputText(clip.originalText);
      setEnhancedText(clip.enhancedText ?? "");
      setSegments([segment]);
      setIsSegmented(false);
      setDisplayMode("playback");
    },
    [revokeSegmentUrls, segments],
  );

  // Handle simple (non-segmented) flow
  const handleSimpleGenerate = async () => {
    // Create single segment
    const segment: TextSegment = {
      id: `segment-${Date.now()}-0`,
      index: 0,
      originalText: inputText,
      processedText: null,
      status: "pending",
      audioData: null,
      audioUrl: null,
      generationStatus: "generate",
    };
    revokeSegmentUrls(segments);
    setSegments([segment]);
    setIsSegmented(false);
    await generateSegment(segment.id, [segment]);
  };

  // Update segment status
  const handleSegmentStatusChange = (segmentId: string, status: "generate" | "skip" | "preview") => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, generationStatus: status } : s))
    );
  };

  // Generate single segment with streaming progress
  async function generateSegment(segmentId: string, currentSegments?: TextSegment[]) {
    const segs = currentSegments || segments;
    const segment = segs.find((s) => s.id === segmentId);
    if (!segment || segment.generationStatus === "skip") return;

    logger.log("generateSegment", "start", { segmentId, textLength: (segment.processedText || segment.originalText).length });

    setCurrentGeneratingId(segmentId);
    setIsLoading(true);
    setDisplayMode("generating");
    setGenerationProgress(0);
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, status: "generating" } : s)),
    );

    // Use a local variable so we don't rely on async state updates during transform.
    let textToGenerate = segment.processedText || segment.originalText;
    const estimate = calculateTokenUsage(textToGenerate, selectedModel);
    setEstimatedDurationMs(estimate.estimatedDurationMs);

    try {
      // First transform if needed
      if (processText && !segment.processedText) {
        setDisplayMode("transforming");
        const transformRes = await fetch("/api/ai/tts/transform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: segment.originalText }),
        });

        if (!transformRes.ok) {
          const errText = await transformRes.text().catch(() => "");
          throw new Error(errText || "Transform failed");
        }
        const transformData = await transformRes.json();

        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId ? { ...s, processedText: transformData.transformedText } : s
          )
        );

        textToGenerate = transformData.transformedText;
        const newEstimate = calculateTokenUsage(transformData.transformedText, selectedModel);
        setEstimatedDurationMs(newEstimate.estimatedDurationMs);
      }

      setDisplayMode("generating");

      logger.log("generateSegment", "fetching /api/ai/tts/stream", { textLength: textToGenerate.length, model: selectedModel });

      // Use streaming API for generation with progress
      const response = await fetch("/api/ai/tts/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToGenerate,
          model: selectedModel,
          segmentId,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(errText || "Failed to generate speech");
      }
      if (!response.body) throw new Error("No response body");

      logger.log("generateSegment", "stream connected, reading SSE");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line.
        // We must buffer because events can be split across network chunks.
        while (true) {
          const separatorIndex = buffer.indexOf("\n\n");
          if (separatorIndex === -1) break;

          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);

          // Collect all `data:` lines for this event (SSE spec allows multi-line data).
          const dataLines = rawEvent
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trimStart());

          const payload = dataLines.join("\n");
          if (!payload) continue;

          let data: any;
          try {
            data = JSON.parse(payload);
          } catch {
            // Incomplete JSON (event got split oddly). Put it back and wait for more.
            buffer = `${rawEvent}\n\n${buffer}`;
            break;
          }

          if (data.type === "progress") {
            setGenerationProgress(data.progress);
            if (data.estimatedMs) setEstimatedDurationMs(data.estimatedMs);
          } else if (data.type === "complete") {
            gotComplete = true;
            const blob = uint8ArrayToBlob(data.audioData);
            const url = URL.createObjectURL(blob);
            const blobSize = blob.size;

            logger.log("generateSegment", "complete event", {
              segmentId,
              blobSize,
              blobType: blob.type,
            });

            // Persist to local audio library (IndexedDB) for later browsing.
            const createdAt = Date.now();
            const enhanced =
              typeof textToGenerate === "string" && textToGenerate !== segment.originalText
                ? textToGenerate
                : null;
            void saveTtsClip({
              id: `clip-${createdAt}-${segmentId}`,
              createdAt,
              model: selectedModel,
              title: makeClipTitle(textToGenerate),
              originalText: segment.originalText,
              enhancedText: enhanced,
              audioBlob: blob,
              mimeType: String(data.mediaType ?? "audio/mpeg"),
              format: String(data.format ?? "mp3"),
            }).catch((e) => {
              logger.error("Clip save failed", String(e));
            });

            logger.log("generateSegment", "calling setSegments with audioUrl for segmentId", segmentId);

            setSegments((prev) =>
              prev.map((s) =>
                s.id === segmentId
                  ? { ...s, status: "generated", audioData: data.audioData, audioUrl: url }
                  : s,
              ),
            );
            setGenerationProgress(100);

            // Stop reading once complete; don't rely on the server to close promptly.
            try {
              await reader.cancel();
            } catch {
              // ignore
            }
            break;
          } else if (data.type === "error") {
            throw new Error(data.error);
          }
        }

        if (gotComplete) break;
      }

      if (!gotComplete) {
        throw new Error("TTS stream ended without a completion event");
      }

      logger.log("generateSegment", "calling setDisplayMode(playback)");
      setDisplayMode("playback");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      logger.error("Generation failed", String(err));
      setSegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, status: "pending" } : s)),
      );
    } finally {
      setIsLoading(false);
      setCurrentGeneratingId(null);
    }
  }

  // Generate all pending segments
  const handleGenerateAll = async () => {
    const pendingSegments = segments.filter(
      (s) => s.generationStatus === "generate" && s.status !== "generated"
    );

    for (const segment of pendingSegments) {
      await generateSegment(segment.id);
    }
  };

  // Download combined audio
  const handleDownload = () => {
    // For now, download first available generated clip (audioData or audioUrl)
    const first = segments.find((s) => s.audioData || s.audioUrl);
    if (!first) return;

    const filename = `speak-${Date.now()}.mp3`;
    if (first.audioData) {
      const blob = uint8ArrayToBlob(first.audioData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    if (first.audioUrl) {
      fetch(first.audioUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        })
        .catch((e) => logger.error("Download failed", String(e)));
    }
  };

  const handleReset = () => {
    revokeSegmentUrls(segments);
    setSegments([]);
    setIsSegmented(false);
    setDisplayMode("input");
    setError(null);
    setGenerationProgress(0);
  };

  return (
    <Page className="justify-start! overflow-y-auto">
      <div className={cn("w-full flex flex-col flex-1 mx-auto px-4 py-6 md:px-6", displayMode === "input" ? "max-w-6xl" : "max-w-3xl")}>
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              Speak
            </h1>
            <p className="text-sm text-muted-foreground">
              Text to speech — generate and download audio
            </p>
          </div>
        </header>

        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            {/* === INPUT MODE === */}
            {displayMode === "input" ? (
              <motion.div
                key="input"
                {...fadeInUp}
                transition={{ duration: 0.3 }}
                className={isFullscreen ? "fixed inset-0 z-50 p-4 md:p-6 flex flex-col bg-background" : "flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 min-h-0"}
              >
                {isFullscreen ? <div className="absolute inset-0 bg-background -z-10" /> : null}

                {!isFullscreen ? (
                  <aside className="flex flex-col gap-4 min-h-0 lg:min-h-[420px]">
                    {/* Pinned from Chat */}
                    {pinnedList.length > 0 && (
                      <div className={glass()} style={{ borderRadius: "var(--radius-2xl, 1rem)" }}>
                        <div className="p-3 border-b border-white/6">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Pin className="w-3.5 h-3.5" />
                            Pinned from Chat
                          </p>
                        </div>
                        <div className="p-2 flex flex-wrap gap-2">
                          {pinnedList.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleLoadPinned(item)}
                              className="group flex items-center gap-2 max-w-full px-3 py-2 rounded-lg text-left bg-background-tertiary/50 border border-border hover:bg-background-tertiary transition-colors"
                            >
                              <span className="text-sm text-foreground truncate flex-1 min-w-0">
                                {item.title}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleRemovePinned(e, item.id)}
                                aria-label="Remove from pinned"
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background-tertiary text-muted-foreground"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-h-0 flex flex-col">
                      <ClipBrowser
                        variant="inline"
                        onLoadClip={handleLoadClip}
                        className="flex-1 min-h-0"
                      />
                    </div>
                  </aside>
                ) : null}

                <div
                  className={cn(
                    "flex flex-col min-h-0",
                    isFullscreen && "flex-1 max-w-3xl mx-auto w-full",
                    glass(),
                    "rounded-lg overflow-hidden transition-all",
                    isFullscreen && "flex-1 flex flex-col",
                  )}
                >
                  <div className={`p-4 md:p-6 ${isFullscreen ? "flex-1 flex flex-col" : ""}`}>
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-background-tertiary flex items-center justify-center shrink-0">
                          <Edit3 className="w-4 h-4 text-foreground" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-sm font-medium text-foreground">Compose</h2>
                          <p className="text-xs text-muted-foreground">Enter text to synthesize</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {inputEstimates && (
                          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDuration(inputEstimates.estimatedDurationMs)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Volume2 className="w-3.5 h-3.5" />
                              {formatAudioDuration(inputEstimates.estimatedAudioDurationSec)}
                            </span>
                            <span className="text-foreground/70">{formatCost(inputEstimates.estimatedCost)}</span>
                          </div>
                        )}

                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          className={glass()}
                          onPress={() => setIsFullscreen(!isFullscreen)}
                          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                        >
                          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Textarea */}
                    <div className={`relative ${isFullscreen ? "flex-1 flex flex-col" : ""}`}>
                      <textarea
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        placeholder="Paste or type text to turn into speech..."
                        className={`
                              w-full p-4 rounded-lg resize-none
                              bg-background border border-border
                              text-foreground leading-relaxed
                              placeholder:text-muted-foreground
                              focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/20
                              transition-colors
                              ${isFullscreen
                            ? "flex-1 text-base md:text-lg"
                            : isInputExpanded || isInputFocused
                              ? "min-h-[320px] md:min-h-[400px] text-base"
                              : "min-h-[180px] md:min-h-[220px] text-base"
                          }
                            `}
                      />
                      <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                        {!isFullscreen && (
                          <span className="hidden sm:inline">Ctrl+E to expand</span>
                        )}
                        {inputText.length.toLocaleString()} chars
                      </div>
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                      >
                        {error}
                      </motion.div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className={`px-4 md:px-6 py-4 border-t border-border bg-background-tertiary/30 ${isFullscreen ? "shrink-0" : ""}`}>
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={processText}
                            onChange={() => setProcessText(!processText)}
                            className="rounded border-border bg-background text-foreground focus:ring-foreground/20"
                          />
                          <span className="text-sm text-muted-foreground">AI Enhancement</span>
                        </label>
                        <SpeechModelSelector
                          selectedModel={selectedModel}
                          onModelChange={(m) => setSelectedModel(m as TTSModel)}
                          className={glass()}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="bordered"
                          className={glass()}
                          onPress={() => {
                            if (isFullscreen) setIsFullscreen(false);
                            handleSegmentText();
                          }}
                          isDisabled={!inputText.trim()}
                          startContent={<SplitSquareHorizontal className="w-4 h-4" />}
                        >
                          Split & Customize
                        </Button>
                        <Button
                          size="sm"
                          variant="bordered"
                          className={glass()}
                          onPress={() => {
                            if (isFullscreen) setIsFullscreen(false);
                            void handleReviewEnhancedText();
                          }}
                          isDisabled={isLoading || isEnhancing || !inputText.trim()}
                          startContent={isEnhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        >
                          Review Enhanced
                        </Button>
                        <Button
                          size="sm"
                          variant="solid"
                          color="default"
                          className="bg-foreground text-background"
                          onPress={() => {
                            if (isFullscreen) setIsFullscreen(false);
                            handleSimpleGenerate();
                          }}
                          isDisabled={isLoading || !inputText.trim()}
                          startContent={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        >
                          Quick Generate
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {/* === REVIEW ENHANCED TEXT MODE === */}
            {displayMode === "review" && (
              <motion.div
                key="review"
                {...fadeInUp}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className={`${glass()} rounded-lg overflow-hidden`}>
                  <div className="p-4 md:p-6">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-background-tertiary flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-foreground" />
                        </div>
                        <div>
                          <h2 className="text-sm font-medium text-foreground">Review Enhanced Text</h2>
                          <p className="text-xs text-muted-foreground">
                            Edit the speech-friendly version before generating.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="flat" onPress={() => setDisplayMode("input")}>
                          Back
                        </Button>
                        <Button
                          size="sm"
                          variant="bordered"
                          className={glass()}
                          onPress={() => void handleReviewEnhancedText()}
                          isDisabled={isEnhancing}
                          startContent={<RefreshCw className={`w-4 h-4 ${isEnhancing ? "animate-spin" : ""}`} />}
                        >
                          Re-enhance
                        </Button>
                      </div>
                    </div>

                    {isEnhancing ? (
                      <GenerationProgress
                        isActive={true}
                        estimatedDurationMs={Math.max(estimatedDurationMs, 1200)}
                        stage="transforming"
                        className="max-w-xl"
                      />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">Original</div>
                          <textarea
                            value={inputText}
                            readOnly
                            className="w-full min-h-[240px] p-4 rounded-lg resize-none bg-background border border-border text-foreground leading-relaxed focus:outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">Enhanced (editable)</div>
                          <textarea
                            value={enhancedText}
                            onChange={(e) => setEnhancedText(e.target.value)}
                            placeholder="Enhanced text will appear here…"
                            className="w-full min-h-[240px] p-4 rounded-lg resize-none bg-background border border-border text-foreground leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/20"
                          />
                        </div>
                      </div>
                    )}

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                      >
                        {error}
                      </motion.div>
                    )}
                  </div>

                  <div className="px-4 md:px-6 py-4 border-t border-border bg-background-tertiary/30 flex flex-col sm:flex-row gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="bordered"
                      className={glass()}
                      onPress={handleSplitEnhancedText}
                      isDisabled={isEnhancing || !enhancedText.trim()}
                      startContent={<SplitSquareHorizontal className="w-4 h-4" />}
                    >
                      Split Enhanced
                    </Button>
                    <Button
                      size="sm"
                      variant="solid"
                      color="default"
                      className="bg-foreground text-background"
                      onPress={() => void handleGenerateEnhancedWhole()}
                      isDisabled={isEnhancing || isLoading || !enhancedText.trim()}
                      startContent={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    >
                      Generate Enhanced
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* === SEGMENTS MODE === */}
            {displayMode === "segments" && (
              <motion.div
                key="segments"
                {...fadeInUp}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className={`${glass()} rounded-lg overflow-hidden`}>
                  <div className="p-4 md:p-6">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-background-tertiary flex items-center justify-center">
                          <Layers className="w-4 h-4 text-foreground" />
                        </div>
                        <div>
                          <h2 className="text-sm font-medium text-foreground">Segments</h2>
                          <p className="text-xs text-muted-foreground">
                            {segments.length} sections • Choose what to generate
                          </p>
                        </div>
                      </div>

                      <Button size="sm" variant="flat" onPress={handleReset} startContent={<Edit3 className="w-4 h-4" />}>
                        Edit Text
                      </Button>
                    </div>

                    <SegmentManager
                      segments={segments}
                      onSegmentStatusChange={handleSegmentStatusChange}
                      onGenerateSegment={generateSegment}
                      onGenerateAll={handleGenerateAll}
                      model={selectedModel}
                      isGenerating={isLoading}
                      currentGeneratingId={currentGeneratingId}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* === TRANSFORMING/GENERATING MODE === */}
            {(displayMode === "transforming" || displayMode === "generating") && (
              <motion.div
                key="generating"
                {...fadeInUp}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className={`${glass()} rounded-lg p-8 md:p-10`}>
                  <div className="flex flex-col items-center text-center max-w-md mx-auto">
                    <div className="w-14 h-14 rounded-xl bg-background-tertiary flex items-center justify-center mb-6">
                      {displayMode === "transforming" ? (
                        <Sparkles className="w-7 h-7 text-foreground animate-pulse" />
                      ) : (
                        <Volume2 className="w-7 h-7 text-foreground animate-pulse" />
                      )}
                    </div>
                    <GenerationProgress
                      isActive={true}
                      estimatedDurationMs={estimatedDurationMs}
                      stage={displayMode}
                      className="w-full"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* === PLAYBACK MODE === */}
            {displayMode === "playback" && (
              <motion.div
                key="playback"
                {...fadeInUp}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className={`${glass()} rounded-lg overflow-hidden`}>
                  <div className="p-4 md:p-6">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-background-tertiary flex items-center justify-center">
                          <Check className="w-4 h-4 text-foreground" />
                        </div>
                        <div>
                          <h2 className="text-sm font-medium text-foreground">Ready</h2>
                          <p className="text-xs text-muted-foreground">
                            {segments.filter((s) => s.status === "generated").length} of {segments.length} segments generated
                          </p>
                        </div>
                      </div>

                      <Button size="sm" variant="flat" onPress={handleReset} startContent={<FileText className="w-4 h-4" />}>
                        New Text
                      </Button>
                    </div>

                    <UnifiedPlayback
                      segments={segments}
                      onDownload={handleDownload}
                    />
                  </div>
                </div>

                {/* Segment breakdown */}
                {isSegmented && (
                  <div className={`${glass()} rounded-lg p-4 mt-4`}>
                    <p className="text-xs text-muted-foreground mb-3">Segment Details</p>
                    <div className="space-y-2">
                      {segments.map((seg, idx) => (
                        <div key={seg.id} className="flex items-center gap-3 text-sm">
                          <span className="w-5 h-5 rounded bg-background-tertiary flex items-center justify-center text-xs text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${seg.status === "generated"
                                ? "bg-foreground/10 text-foreground"
                                : seg.generationStatus === "skip"
                                  ? "bg-background-tertiary text-muted-foreground"
                                  : "bg-background-tertiary text-muted-foreground"
                              }`}
                          >
                            {seg.status === "generated" ? "Ready" : seg.generationStatus === "skip" ? "Skipped" : "Pending"}
                          </span>
                          <span className="text-muted-foreground truncate flex-1">
                            {(seg.processedText || seg.originalText).slice(0, 50)}…
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </Page>
  );
}

function uint8ArrayToBlob(uint8ArrayData: Record<number, number>): Blob {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));
  return new Blob([uint8Array], { type: "audio/mpeg" });
}
