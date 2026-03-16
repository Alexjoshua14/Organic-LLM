"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  SkipForward,
  Volume2,
  VolumeX,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Clock,
  Sparkles,
} from "lucide-react";

import {
  calculateSegmentedCost,
  formatCost,
  formatDuration,
  formatAudioDuration,
  TTSModel,
} from "@/lib/tts/token-calculator";

export type SegmentStatus = "pending" | "generating" | "generated" | "skipped" | "preview";

export type TextSegment = {
  id: string;
  index: number;
  originalText: string;
  processedText: string | null;
  status: SegmentStatus;
  audioData: Record<number, number> | null;
  audioUrl: string | null;
  generationStatus: "generate" | "skip" | "preview";
};

type SegmentManagerProps = {
  segments: TextSegment[];
  onSegmentStatusChange: (segmentId: string, status: "generate" | "skip" | "preview") => void;
  onGenerateSegment: (segmentId: string) => void;
  onGenerateAll: () => void;
  model: TTSModel;
  isGenerating: boolean;
  currentGeneratingId: string | null;
  className?: string;
};

export function SegmentManager({
  segments,
  onSegmentStatusChange,
  onGenerateSegment,
  onGenerateAll,
  model,
  isGenerating,
  currentGeneratingId,
  className = "",
}: SegmentManagerProps) {
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  const costBreakdown = useMemo(() => {
    const segmentData = segments.map((s) => ({
      text: s.processedText || s.originalText,
      status: s.generationStatus,
    }));

    return calculateSegmentedCost(segmentData, model);
  }, [segments, model]);

  const toggleExpanded = (id: string) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const getStatusIcon = (segment: TextSegment) => {
    if (segment.status === "generating" || currentGeneratingId === segment.id) {
      return <Loader2 className="w-4 h-4 animate-spin text-amber-400" />;
    }
    if (segment.status === "generated") {
      return <Check className="w-4 h-4 text-emerald-400" />;
    }
    if (segment.generationStatus === "skip") {
      return <VolumeX className="w-4 h-4 text-muted-foreground/40" />;
    }
    if (segment.generationStatus === "preview") {
      return <Sparkles className="w-4 h-4 text-violet-400" />;
    }

    return <Volume2 className="w-4 h-4 text-blue-400" />;
  };

  const getStatusLabel = (segment: TextSegment) => {
    if (segment.status === "generating" || currentGeneratingId === segment.id) {
      return "Generating...";
    }
    if (segment.status === "generated") {
      return "Ready";
    }
    if (segment.generationStatus === "skip") {
      return "Skipped";
    }
    if (segment.generationStatus === "preview") {
      return "Preview";
    }

    return "Queued";
  };

  const pendingSegments = segments.filter(
    (s) => s.generationStatus === "generate" && s.status !== "generated"
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400/70" />
            <div>
              <p className="text-xs text-muted-foreground/50">Total Cost</p>
              <p className="text-sm font-medium text-foreground/80 tabular-nums">
                {formatCost(costBreakdown.totalCost)}
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-white/[0.06]" />

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400/70" />
            <div>
              <p className="text-xs text-muted-foreground/50">Gen. Time</p>
              <p className="text-sm font-medium text-foreground/80 tabular-nums">
                {formatDuration(costBreakdown.totalDurationMs)}
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-white/[0.06]" />

          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-purple-400/70" />
            <div>
              <p className="text-xs text-muted-foreground/50">Audio</p>
              <p className="text-sm font-medium text-foreground/80 tabular-nums">
                {formatAudioDuration(costBreakdown.totalAudioDurationSec)}
              </p>
            </div>
          </div>
        </div>

        {pendingSegments.length > 0 && (
          <button
            className={`
              px-5 py-2.5 rounded-xl text-sm font-medium
              bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white
              shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30
              hover:scale-[1.02] transition-all duration-300
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
            `}
            disabled={isGenerating}
            onClick={onGenerateAll}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Generate All ({pendingSegments.length})
              </span>
            )}
          </button>
        )}
      </div>

      {/* Segments List */}
      <div className="space-y-2">
        {segments.map((segment, idx) => {
          const isExpanded = expandedSegments.has(segment.id);
          const segmentCost = costBreakdown.breakdown[idx];
          const text = segment.processedText || segment.originalText;
          const preview = text.length > 80 ? text.slice(0, 80) + "..." : text;

          return (
            <motion.div
              key={segment.id}
              animate={{ opacity: 1, y: 0 }}
              className={`
                rounded-xl border transition-all duration-300
                ${
                  segment.status === "generated"
                    ? "bg-emerald-500/[0.03] border-emerald-500/20"
                    : segment.generationStatus === "skip"
                      ? "bg-white/[0.01] border-white/[0.04] opacity-60"
                      : currentGeneratingId === segment.id
                        ? "bg-amber-500/[0.03] border-amber-500/30"
                        : "bg-white/[0.02] border-white/[0.06]"
                }
              `}
              initial={{ opacity: 0, y: 10 }}
              transition={{ delay: idx * 0.05 }}
            >
              {/* Segment Header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => toggleExpanded(segment.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center text-xs font-medium text-foreground/50">
                    {idx + 1}
                  </span>

                  {getStatusIcon(segment)}

                  <p className="text-sm text-foreground/70 truncate flex-1">{preview}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`
                    text-xs px-2 py-1 rounded-lg
                    ${
                      segment.status === "generated"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : segment.generationStatus === "skip"
                          ? "bg-white/5 text-muted-foreground/50"
                          : segment.generationStatus === "preview"
                            ? "bg-violet-500/10 text-violet-400"
                            : "bg-blue-500/10 text-blue-400"
                    }
                  `}
                  >
                    {getStatusLabel(segment)}
                  </span>

                  <span className="text-xs text-muted-foreground/40 tabular-nums w-16 text-right">
                    {segmentCost && formatCost(segmentCost.cost)}
                  </span>

                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground/40" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    className="overflow-hidden"
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-4 pb-4 space-y-3">
                      {/* Full Text */}
                      <div className="p-3 rounded-lg bg-black/20 text-sm text-foreground/60 leading-relaxed max-h-32 overflow-y-auto">
                        {text}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            className={`
                              px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                              ${
                                segment.generationStatus === "generate"
                                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                  : "bg-white/5 text-muted-foreground/60 hover:bg-white/10"
                              }
                            `}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSegmentStatusChange(segment.id, "generate");
                            }}
                          >
                            <span className="flex items-center gap-1.5">
                              <Volume2 className="w-3 h-3" />
                              Full Audio
                            </span>
                          </button>

                          <button
                            className={`
                              px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                              ${
                                segment.generationStatus === "preview"
                                  ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                                  : "bg-white/5 text-muted-foreground/60 hover:bg-white/10"
                              }
                            `}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSegmentStatusChange(segment.id, "preview");
                            }}
                          >
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3" />
                              Preview Only
                            </span>
                          </button>

                          <button
                            className={`
                              px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                              ${
                                segment.generationStatus === "skip"
                                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                  : "bg-white/5 text-muted-foreground/60 hover:bg-white/10"
                              }
                            `}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSegmentStatusChange(segment.id, "skip");
                            }}
                          >
                            <span className="flex items-center gap-1.5">
                              <SkipForward className="w-3 h-3" />
                              Skip
                            </span>
                          </button>
                        </div>

                        {segment.generationStatus === "generate" &&
                          segment.status !== "generated" && (
                            <button
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                              disabled={isGenerating}
                              onClick={(e) => {
                                e.stopPropagation();
                                onGenerateSegment(segment.id);
                              }}
                            >
                              Generate Now
                            </button>
                          )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground/40 pt-2">
        <span className="flex items-center gap-1.5">
          <Volume2 className="w-3 h-3 text-blue-400" />
          Full: Premium audio
        </span>
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-violet-400" />
          Preview: Cheap placeholder
        </span>
        <span className="flex items-center gap-1.5">
          <VolumeX className="w-3 h-3" />
          Skip: Silent gap
        </span>
      </div>
    </div>
  );
}
