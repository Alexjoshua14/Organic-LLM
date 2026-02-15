"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Library,
  Pin,
  Trash2,
} from "lucide-react";

import Page from "@/components/layout/page";
import { createLogger } from "@/lib/logger";
import ShinyText from "@/components/ShinyText";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { AdaptiveOrganicPresence } from "@/components/ambient/AdaptiveOrganicPresence";
import { SpeechModelSelector } from "@/components/chat/speech-model-selector";
import { TokenUsageDisplay, CompactTokenUsageDisplay } from "@/components/tts/TokenUsageDisplay";
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

const BACKGROUND_SPEED = 0.06;

type DisplayMode =
  | "input"
  | "review"
  | "segments"
  | "transforming"
  | "generating"
  | "playback";
type PresenceState = "idle" | "active" | "thinking" | "responding";

function getPresenceState(displayMode: DisplayMode, isInputFocused: boolean, isPlaying: boolean): PresenceState {
  if (isPlaying) return "responding";
  switch (displayMode) {
    case "input": return isInputFocused ? "active" : "idle";
    case "segments": return "active";
    case "review": return "active";
    case "transforming":
    case "generating": return "thinking";
    case "playback": return "active";
    default: return "idle";
  }
}

const glassPanel = `backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.12)]`;
const glassCard = `backdrop-blur-md bg-white/[0.02] border border-white/[0.06]`;

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

  // Saved clip browser
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

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

  const presenceState = getPresenceState(displayMode, isInputFocused, isPlaying);

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
      setIsLibraryOpen(false);

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

            // --- CLIENT DIAGNOSTICS ---
            // Test if the blob is actually playable, bypassing UnifiedPlayback entirely.
            const audioDataKeys = typeof data.audioData === "object" ? Object.keys(data.audioData).length : 0;
            const firstValues = typeof data.audioData === "object"
              ? Object.values(data.audioData).slice(0, 10) as number[]
              : [];
            logger.log("generateSegment", "complete event", {
              segmentId,
              blobSize,
              blobType: blob.type,
              urlPrefix: url.slice(0, 30) + "...",
              audioDataKeys,
              firstBytes: firstValues,
              firstBytesHex: firstValues.map((b) => b.toString(16).padStart(2, "0")).join(" "),
            });

            // Direct blob playback test — does the blob actually produce playable audio?
            try {
              const testAudio = new Audio(url);
              testAudio.addEventListener("loadedmetadata", () => {
                logger.log("generateSegment", "BLOB TEST: loadedmetadata", {
                  duration: testAudio.duration,
                  readyState: testAudio.readyState,
                });
              });
              testAudio.addEventListener("canplay", () => {
                logger.log("generateSegment", "BLOB TEST: canplay ✅", {
                  readyState: testAudio.readyState,
                  duration: testAudio.duration,
                });
              });
              testAudio.addEventListener("error", () => {
                const err = testAudio.error;
                logger.error("generateSegment", "BLOB TEST: error ❌", {
                  code: err?.code,
                  message: err?.message,
                  readyState: testAudio.readyState,
                });
              });
              // Give it 3s then log the final state
              setTimeout(() => {
                logger.log("generateSegment", "BLOB TEST: final state after 3s", {
                  readyState: testAudio.readyState,
                  networkState: testAudio.networkState,
                  duration: testAudio.duration,
                  error: testAudio.error ? { code: testAudio.error.code, message: testAudio.error.message } : null,
                  paused: testAudio.paused,
                  src: testAudio.src?.slice(0, 40),
                });
              }, 3000);
            } catch (e) {
              logger.error("generateSegment", "BLOB TEST: Audio constructor threw", String(e));
            }
            // --- END CLIENT DIAGNOSTICS ---

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

    const filename = `prometheus-${Date.now()}.mp3`;
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

  // Reset to input
  const handleReset = () => {
    revokeSegmentUrls(segments);
    setSegments([]);
    setIsSegmented(false);
    setDisplayMode("input");
    setError(null);
    setGenerationProgress(0);
  };

  // Stage indicator
  const getStageNumber = () => {
    switch (displayMode) {
      case "input": return 1;
      case "review": return 2;
      case "segments": return 2;
      case "transforming":
      case "generating": return 3;
      case "playback": return 4;
      default: return 1;
    }
  };

  return (
    <Page>
      <AdaptiveLiquidChrome speed={BACKGROUND_SPEED} dimIntensity={0.35} restDelay={3500} />
      <AdaptiveOrganicPresence state={presenceState} position="bottom-left" size={100} />

      <div className="w-full h-full overflow-y-auto z-10">
        <div className="min-h-full flex flex-col">
          {/* Header */}
          <header className="w-full pt-8 pb-6 px-6">
            <div className="max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="flex items-center justify-between"
              >
                <div className="space-y-1">
                  <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-foreground/90">
                    Prometheus
                  </h1>
                  <p className="text-sm text-muted-foreground/60 font-light tracking-wide">
                    Voice Synthesis Engine
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsLibraryOpen(true)}
                    className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
                    title="Open audio library"
                    data-dim-background
                  >
                    <Library className="w-4.5 h-4.5 text-foreground/70" />
                  </button>

                  {/* Stage Indicator */}
                  <div className="hidden sm:flex items-center gap-2">
                    {[1, 2, 3, 4].map((stage) => (
                      <div key={stage} className="flex items-center gap-2">
                        <div
                          className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                            transition-all duration-700 ease-out
                            ${getStageNumber() >= stage
                              ? "bg-white/10 text-foreground/80 border border-white/20"
                              : "bg-white/[0.02] text-foreground/30 border border-white/[0.05]"}
                          `}
                        >
                          {stage}
                        </div>
                        {stage < 4 && (
                          <div className={`w-6 h-px transition-colors duration-700 ${getStageNumber() > stage ? "bg-white/20" : "bg-white/[0.05]"}`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 px-6 pb-8">
            <div className="max-w-5xl mx-auto">
              <AnimatePresence mode="wait">
                {/* === INPUT MODE === */}
                {displayMode === "input" && (
                  <motion.div
                    key="input"
                    {...fadeInUp}
                    transition={{ duration: 0.5 }}
                    className={`
                      ${isFullscreen ? "fixed inset-0 z-50 p-4 md:p-8 flex flex-col" : "space-y-6"}
                    `}
                  >
                    {/* Fullscreen backdrop */}
                    {isFullscreen && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-xl -z-10"
                      />
                    )}

                    <div
                      className={`
                        ${glassPanel} rounded-3xl overflow-hidden
                        transition-all duration-500 ease-out
                        ${isFullscreen ? "flex-1 flex flex-col max-w-6xl mx-auto w-full" : ""}
                      `}
                      data-dim-background
                    >
                      <div className={`p-6 md:p-8 ${isFullscreen ? "flex-1 flex flex-col" : ""}`}>
                        {/* Input Header */}
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                              <Edit3 className="w-5 h-5 text-violet-400/80" />
                            </div>
                            <div>
                              <h2 className="text-lg font-medium text-foreground/90">Compose</h2>
                              <p className="text-xs text-muted-foreground/50">Enter text to synthesize</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {inputEstimates && (
                              <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground/50">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatDuration(inputEstimates.estimatedDurationMs)} gen
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Volume2 className="w-3.5 h-3.5" />
                                  {formatAudioDuration(inputEstimates.estimatedAudioDurationSec)} audio
                                </span>
                                <span className="flex items-center gap-1.5 text-emerald-400/70">
                                  {formatCost(inputEstimates.estimatedCost)}
                                </span>
                              </div>
                            )}

                            {/* Fullscreen toggle button */}
                            <button
                              onClick={() => setIsFullscreen(!isFullscreen)}
                              className={`
                                p-2 rounded-xl transition-all duration-300
                                hover:bg-white/10 text-muted-foreground/50 hover:text-foreground/80
                                ${isFullscreen ? "bg-white/5" : ""}
                              `}
                              title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (Ctrl+E)"}
                            >
                              {isFullscreen ? (
                                <Minimize2 className="w-4 h-4" />
                              ) : (
                                <Maximize2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Pinned from Chat */}
                        {pinnedList.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-medium text-muted-foreground/70 mb-2 flex items-center gap-1.5">
                              <Pin className="w-3.5 h-3.5" />
                              Pinned from Chat
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {pinnedList.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleLoadPinned(item)}
                                  className={`
                                    group flex items-center gap-2 max-w-full
                                    px-3 py-2 rounded-xl text-left
                                    bg-white/[0.04] border border-white/[0.06]
                                    hover:bg-white/[0.08] hover:border-white/[0.1]
                                    transition-colors
                                  `}
                                >
                                  <span className="text-sm text-foreground/90 truncate flex-1 min-w-0">
                                    {item.title}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleRemovePinned(e, item.id)}
                                    aria-label="Remove from pinned"
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/10 text-muted-foreground"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Textarea */}
                        <div className={`relative ${isFullscreen ? "flex-1 flex flex-col" : ""}`}>
                          <textarea
                            ref={textareaRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            placeholder="Write something beautiful..."
                            className={`
                              w-full p-5 rounded-2xl resize-none
                              bg-white/[0.02] border border-white/[0.06]
                              text-foreground/90 leading-relaxed
                              placeholder:text-muted-foreground/30
                              focus:outline-none focus:border-violet-500/30 focus:bg-white/[0.03]
                              transition-all duration-500 ease-out
                              ${isFullscreen
                                ? "flex-1 text-lg md:text-xl"
                                : isInputExpanded || isInputFocused
                                  ? "min-h-[400px] md:min-h-[500px] text-base md:text-lg"
                                  : "min-h-[200px] md:min-h-[260px] text-base md:text-lg"
                              }
                            `}
                          />
                          <div className={`
                            absolute bottom-4 right-4 flex items-center gap-3
                            text-xs text-muted-foreground/40 tabular-nums
                          `}>
                            {!isFullscreen && (
                              <span className="hidden sm:inline text-muted-foreground/30">
                                Ctrl+E to expand
                              </span>
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
                      <div className={`
                        px-6 md:px-8 py-5 bg-white/[0.01] border-t border-white/[0.04]
                        ${isFullscreen ? "shrink-0" : ""}
                      `}>
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            {/* AI Enhancement Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div
                                className={`
                                  relative w-11 h-6 rounded-full transition-all duration-300
                                  ${processText ? "bg-gradient-to-r from-violet-600 to-fuchsia-600" : "bg-white/10"}
                                `}
                                onClick={() => setProcessText(!processText)}
                              >
                                <div
                                  className={`
                                    absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg
                                    transition-all duration-300 ease-out
                                    ${processText ? "left-6" : "left-1"}
                                  `}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground/70">AI Enhancement</span>
                            </label>

                            <div data-dim-background>
                              <SpeechModelSelector
                                selectedModel={selectedModel}
                                onModelChange={(m) => setSelectedModel(m as TTSModel)}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            {/* Segment Button */}
                            <button
                              onClick={() => {
                                if (isFullscreen) setIsFullscreen(false);
                                handleSegmentText();
                              }}
                              disabled={!inputText.trim()}
                              className={`
                                flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-medium
                                bg-white/5 text-foreground/70 border border-white/10
                                hover:bg-white/10 transition-all duration-300
                                disabled:opacity-40 disabled:cursor-not-allowed
                              `}
                            >
                              <span className="flex items-center justify-center gap-2">
                                <SplitSquareHorizontal className="w-4 h-4" />
                                Split & Customize
                              </span>
                            </button>

                            {/* Review Enhanced Text Button */}
                            <button
                              onClick={() => {
                                if (isFullscreen) setIsFullscreen(false);
                                void handleReviewEnhancedText();
                              }}
                              disabled={isLoading || isEnhancing || !inputText.trim()}
                              className={`
                                flex-1 sm:flex-none px-5 py-3 rounded-xl text-sm font-medium
                                bg-white/5 text-foreground/70 border border-white/10
                                hover:bg-white/10 transition-all duration-300
                                disabled:opacity-40 disabled:cursor-not-allowed
                              `}
                            >
                              <span className="flex items-center justify-center gap-2">
                                {isEnhancing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Sparkles className="w-4 h-4" />
                                )}
                                Review Enhanced
                              </span>
                            </button>

                            {/* Quick Generate Button */}
                            <button
                              onClick={() => {
                                if (isFullscreen) setIsFullscreen(false);
                                handleSimpleGenerate();
                              }}
                              disabled={isLoading || !inputText.trim()}
                              className={`
                                flex-1 sm:flex-none px-6 py-3 rounded-xl text-sm font-medium
                                bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white
                                shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40
                                hover:scale-[1.02] transition-all duration-500
                                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
                              `}
                            >
                              <span className="flex items-center justify-center gap-2">
                                {isLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Wand2 className="w-4 h-4" />
                                )}
                                Quick Generate
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* === REVIEW ENHANCED TEXT MODE === */}
                {displayMode === "review" && (
                  <motion.div
                    key="review"
                    {...fadeInUp}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    <div className={`${glassPanel} rounded-3xl overflow-hidden`} data-dim-background>
                      <div className="p-6 md:p-8">
                        <div className="flex items-center justify-between gap-4 mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-violet-400/80" />
                            </div>
                            <div>
                              <h2 className="text-lg font-medium text-foreground/90">Review Enhanced Text</h2>
                              <p className="text-xs text-muted-foreground/50">
                                Preview and optionally edit the speech-friendly version before generating.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDisplayMode("input")}
                              className="px-4 py-2 rounded-xl text-sm text-muted-foreground/60 hover:text-foreground/80 hover:bg-white/[0.03] transition-all"
                            >
                              Back
                            </button>
                            <button
                              onClick={() => void handleReviewEnhancedText()}
                              disabled={isEnhancing}
                              className="px-4 py-2 rounded-xl text-sm text-foreground/70 bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-40"
                              title="Re-run enhancement"
                            >
                              <span className="flex items-center gap-2">
                                <RefreshCw className={`w-4 h-4 ${isEnhancing ? "animate-spin" : ""}`} />
                                Re-enhance
                              </span>
                            </button>
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
                              <div className="text-xs text-muted-foreground/60">Original</div>
                              <textarea
                                value={inputText}
                                readOnly
                                className={`
                                  w-full min-h-[280px] p-4 rounded-2xl resize-none
                                  bg-white/[0.02] border border-white/[0.06]
                                  text-foreground/70 leading-relaxed
                                  focus:outline-none
                                `}
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground/60">Enhanced (editable)</div>
                              <textarea
                                value={enhancedText}
                                onChange={(e) => setEnhancedText(e.target.value)}
                                placeholder="Enhanced text will appear here…"
                                className={`
                                  w-full min-h-[280px] p-4 rounded-2xl resize-none
                                  bg-white/[0.03] border border-white/[0.10]
                                  text-foreground/90 leading-relaxed
                                  placeholder:text-muted-foreground/30
                                  focus:outline-none focus:border-violet-500/30
                                `}
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

                      <div className="px-6 md:px-8 py-5 bg-white/[0.01] border-t border-white/[0.04]">
                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                          <button
                            onClick={handleSplitEnhancedText}
                            disabled={isEnhancing || !enhancedText.trim()}
                            className={`
                              px-5 py-3 rounded-xl text-sm font-medium
                              bg-white/5 text-foreground/70 border border-white/10
                              hover:bg-white/10 transition-all duration-300
                              disabled:opacity-40 disabled:cursor-not-allowed
                            `}
                          >
                            <span className="flex items-center justify-center gap-2">
                              <SplitSquareHorizontal className="w-4 h-4" />
                              Split Enhanced
                            </span>
                          </button>
                          <button
                            onClick={() => void handleGenerateEnhancedWhole()}
                            disabled={isEnhancing || isLoading || !enhancedText.trim()}
                            className={`
                              px-6 py-3 rounded-xl text-sm font-medium
                              bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white
                              shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40
                              hover:scale-[1.02] transition-all duration-500
                              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100
                            `}
                          >
                            <span className="flex items-center justify-center gap-2">
                              {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Wand2 className="w-4 h-4" />
                              )}
                              Generate Enhanced
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* === SEGMENTS MODE === */}
                {displayMode === "segments" && (
                  <motion.div
                    key="segments"
                    {...fadeInUp}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    <div className={`${glassPanel} rounded-3xl overflow-hidden`}>
                      <div className="p-6 md:p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                              <Layers className="w-5 h-5 text-blue-400/80" />
                            </div>
                            <div>
                              <h2 className="text-lg font-medium text-foreground/90">Segments</h2>
                              <p className="text-xs text-muted-foreground/50">
                                {segments.length} sections • Choose what to generate
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground/60 hover:text-foreground/80 hover:bg-white/[0.03] transition-all"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit Text
                          </button>
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
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    <div className={`${glassPanel} rounded-3xl p-8 md:p-12`}>
                      <div className="flex flex-col items-center text-center max-w-lg mx-auto">
                        <div className="relative mb-8">
                          <div className={`
                            w-20 h-20 rounded-3xl flex items-center justify-center
                            ${displayMode === "transforming"
                              ? "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20"
                              : "bg-gradient-to-br from-amber-500/20 to-orange-500/20"
                            }
                          `}>
                            {displayMode === "transforming" ? (
                              <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
                            ) : (
                              <Volume2 className="w-8 h-8 text-amber-400 animate-pulse" />
                            )}
                          </div>
                          <div className={`
                            absolute inset-0 rounded-3xl blur-xl animate-pulse
                            ${displayMode === "transforming" ? "bg-violet-500/20" : "bg-amber-500/20"}
                          `} />
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
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    <div className={`${glassPanel} rounded-3xl overflow-hidden`} data-dim-background>
                      <div className="p-6 md:p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                              <Check className="w-5 h-5 text-emerald-400/80" />
                            </div>
                            <div>
                              <h2 className="text-lg font-medium text-foreground/90">Ready</h2>
                              <p className="text-xs text-muted-foreground/50">
                                {segments.filter((s) => s.status === "generated").length} of {segments.length} segments generated
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground/60 hover:text-foreground/80 hover:bg-white/[0.03] transition-all"
                          >
                            <FileText className="w-4 h-4" />
                            New Text
                          </button>
                        </div>

                        <UnifiedPlayback
                          segments={segments}
                          onDownload={handleDownload}
                        />
                      </div>
                    </div>

                    {/* Segment breakdown */}
                    {isSegmented && (
                      <div className={`${glassCard} rounded-2xl p-4`}>
                        <p className="text-xs text-muted-foreground/50 mb-3">Segment Details</p>
                        <div className="space-y-2">
                          {segments.map((seg, idx) => (
                            <div
                              key={seg.id}
                              className="flex items-center gap-3 text-sm"
                            >
                              <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-xs text-foreground/50">
                                {idx + 1}
                              </span>
                              <span className={`
                                text-xs px-2 py-0.5 rounded
                                ${seg.status === "generated"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : seg.generationStatus === "skip"
                                    ? "bg-white/5 text-muted-foreground/40"
                                    : "bg-amber-500/10 text-amber-400"
                                }
                              `}>
                                {seg.status === "generated" ? "Ready" : seg.generationStatus === "skip" ? "Skipped" : "Pending"}
                              </span>
                              <span className="text-foreground/50 truncate flex-1">
                                {(seg.processedText || seg.originalText).slice(0, 50)}...
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>

          <div className="h-20" />
        </div>
      </div>

      <ClipBrowser
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onLoadClip={handleLoadClip}
      />
    </Page>
  );
}

function uint8ArrayToBlob(uint8ArrayData: Record<number, number>): Blob {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));
  return new Blob([uint8Array], { type: "audio/mpeg" });
}
