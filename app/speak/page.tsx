"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Switch } from "@heroui/switch";
import {
  Volume2,
  Loader2,
  Download,
  Trash2,
  Play,
  Pause,
  X,
  Edit3,
} from "lucide-react";

import Page from "@/components/layout/page";
import { createLogger } from "@/lib/logger";
import ShinyText from "@/components/ShinyText";
import { LiquidChrome } from "@/components/third-party/reactbits/LiquidChrome/LiquidChrome";
import "@/components/third-party/reactbits/LiquidChrome/LiquidChrome.css";
import { APIResponseView } from "@/components/dev/api-response-view";
import { SpeechModelSelector } from "@/components/chat/speech-model-selector";
import { glass } from "@/components/design-system/primitives";

const logger = createLogger("app/speak/page.tsx");

const BACKGROUND_SPEED = 0.24;

type TTSResponse = {
  data: {
    uint8ArrayData: Record<number, number>;
    mediaType: string;
    format: "mp3" | "ogg" | "wav";
  };
};

type AudioHistoryItem = {
  id: string;
  text: string;
  timestamp: number;
  audioData: Record<number, number>;
  processed: boolean;
  apiResponse?: TTSResponse;
};

type DisplayMode = "input" | "processing" | "ready" | "playing";

const STORAGE_KEY = "tts-audio-history";
const MAX_HISTORY_ITEMS = 10;

export default function SpeakPage() {
  const [inputText, setInputText] = useState("");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("input");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processText, setProcessText] = useState(true);
  const [selectedModel, setSelectedModel] = useState("eleven_flash_v2_5");
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentAudioData, setCurrentAudioData] = useState<Record<
    number,
    number
  > | null>(null);
  const [audioHistory, setAudioHistory] = useState<AudioHistoryItem[]>([]);
  const [currentAudioItem, setCurrentAudioItem] =
    useState<AudioHistoryItem | null>(null);
  const [apiResponse, setApiResponse] = useState<string | null>(null);

  const currentAudioRef = useRef<HTMLAudioElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored) as AudioHistoryItem[];

        setAudioHistory(parsed);
      }
    } catch (err) {
      logger.error("Failed to load audio history", String(err));
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(audioHistory));
    } catch (err) {
      logger.error("Failed to save audio history", String(err));
    }
  }, [audioHistory]);

  useEffect(() => {
    // Truncate the uint8ArrayData in the preview if present
    const apiResponseData = currentAudioItem?.apiResponse?.data;
    let displayApiResponse;

    if (apiResponseData && apiResponseData.uint8ArrayData) {
      displayApiResponse = {
        ...apiResponseData,
        uint8ArrayData: `[Uint8 data: length ${Object.keys(apiResponseData.uint8ArrayData).length}]`,
      };
    } else if (apiResponseData) {
      displayApiResponse = apiResponseData;
    } else {
      displayApiResponse = "Undefined";
    }
    const parsedAPIResponse = JSON.stringify(displayApiResponse, null, 2);

    setApiResponse(parsedAPIResponse);
  }, [currentAudioItem]);

  const handleGenerateSpeech = async () => {
    if (displayMode === "processing") {
      logger.log("handleGenerateSpeech", "Already processing, skipping...");

      return;
    }

    if (!inputText.trim()) {
      setError("Please enter some text");

      return;
    }

    setIsLoading(true);
    setError(null);
    setDisplayMode("processing");

    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: inputText,
          model: selectedModel,
          skipTransform: !processText,
          timestamps: "word",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate speech");
      }

      const data = (await res.json()) as TTSResponse;
      const audioData = data.data.uint8ArrayData;

      // Create blob and URL for playback
      const blob = uint8ArrayToBlob(audioData);
      const url = URL.createObjectURL(blob);

      setCurrentAudioUrl(url);
      setCurrentAudioData(audioData);
      setDisplayMode("ready");

      // Add to history
      const historyItem: AudioHistoryItem = {
        id: Date.now().toString(),
        text: inputText,
        timestamp: Date.now(),
        audioData: audioData,
        processed: processText,
        apiResponse: data,
      };

      setCurrentAudioItem(historyItem);

      setAudioHistory((prev) => {
        const newHistory = [historyItem, ...prev];

        return newHistory.slice(0, MAX_HISTORY_ITEMS);
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      logger.error("TTS generation failed", String(err));
      setDisplayMode("input");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.play();
    }
  };

  const handlePause = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
  };

  const handleAudioPlay = () => {
    setDisplayMode("playing");
  };

  const handleAudioPause = () => {
    setDisplayMode("ready");
  };

  const handleAudioEnded = () => {
    setDisplayMode("ready");
  };

  const handleEdit = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    setDisplayMode("input");
  };

  const handleDownloadCurrent = () => {
    if (!currentAudioData) return;
    downloadAudio(currentAudioData, `tts-${Date.now()}.mp3`);
  };

  const handleDownloadHistoryItem = (item: AudioHistoryItem) => {
    const filename = `tts-${new Date(item.timestamp).toISOString().slice(0, 19).replace(/:/g, "-")}.mp3`;

    downloadAudio(item.audioData, filename);
  };

  const downloadAudio = (
    audioData: Record<number, number>,
    filename: string,
  ) => {
    const blob = uint8ArrayToBlob(audioData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadHistoryItem = (item: AudioHistoryItem) => {
    // Clean up current audio if exists
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl(null);
    }

    // Load history item into main component
    setCurrentAudioItem(item);
    setInputText(item.text);
    setCurrentAudioData(item.audioData);

    const blob = uint8ArrayToBlob(item.audioData);
    const url = URL.createObjectURL(blob);

    setCurrentAudioUrl(url);
    setDisplayMode("ready");

    // Auto-play after a brief moment to ensure audio element is ready
    setTimeout(() => {
      if (currentAudioRef.current) {
        currentAudioRef.current.play();
      }
    }, 100);
  };

  const handleDeleteHistoryItem = (id: string) => {
    setAudioHistory((prev) => prev.filter((item) => item.id !== id));
    if (currentAudioItem?.id === id) {
      handleClearCurrent();
    }
  };

  const handleClearHistory = () => {
    setAudioHistory([]);
  };

  const handleClearCurrent = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }
    setCurrentAudioUrl(null);
    setCurrentAudioData(null);
    setCurrentAudioItem(null);
    setInputText("");
    setDisplayMode("input");
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <Page>
      <APIResponseView apiResponse={apiResponse ?? "Undefined"} />
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <LiquidChrome
          amplitude={0.42}
          baseColor={[0.05, 0.08, 0.1]}
          interactive={true}
          speed={BACKGROUND_SPEED}
        />
      </div>
      <div className="w-full h-full overflow-y-auto z-10">
        <div className="w-full max-w-5xl mx-auto p-8 space-y-8">
          {/* Header */}
          <div
            className={`${glass()} text-center space-y-2 rounded-xl px-9 py-3 w-fit mx-auto cursor-default select-none`}
          >
            <h1
              className="font-commissioner font-medium tracking-[-0.02em] leading-none cursor-default"
              style={{
                fontSize: "clamp(2rem, 6vw, 4rem)",
              }}
            >
              Prometheus
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Speech Generation
            </p>
          </div>

          {/* Main Text Display Area */}
          <div className="space-y-4">
            {displayMode === "input" ? (
              // Input Mode: Editable Textarea
              <>
                <Textarea
                  classNames={{
                    input: ["bg-transparent", "text-base", "p-2"],
                    inputWrapper: [
                      "border-border",
                      "hover:border-ring",
                      "focus-within:border-primary",
                      "backdrop-blur-sm",
                      "bg-gradient-to-br",
                      "from-card/90",
                      "to-card/75",
                      "backdrop-invert-75",
                      "backdrop-brightness-50",
                    ],
                  }}
                  maxRows={12}
                  minRows={4}
                  placeholder="Enter your text here. It will be converted to speech using AI..."
                  value={inputText}
                  onValueChange={setInputText}
                />

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
                    {error}
                  </div>
                )}

                {/* Controls Row */}
                <div className="flex flex-row gap-4 items-stretch sm:items-center justify-between">
                  <div className="flex items-center gap-9">
                    <Switch
                      classNames={{
                        wrapper:
                          "group-data-[selected=true]:bg-gradient-to-r from-purple-600 to-blue-600",
                      }}
                      isSelected={processText}
                      size="sm"
                      onValueChange={setProcessText}
                    >
                      <span className="text-sm text-muted-foreground">
                        Process Text for Speech
                      </span>
                    </Switch>
                    <SpeechModelSelector
                      selectedModel={selectedModel}
                      onModelChange={setSelectedModel}
                    />
                  </div>

                  <Button
                    className={`${glass()} w-fit py-3 px-9 border-white/25 border-t-1 border-x-1.5 border-b-1.5 hover:border-teal-300/45`}
                    disabled={isLoading || !inputText.trim()}
                    size="lg"
                    onPress={handleGenerateSpeech}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-5 h-5 mr-2" />
                        Generate Speech
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              // Processing/Ready/Playing Modes: Engraved Text Display
              <div className="space-y-4">
                <div
                  className={`
                    bg-gradient-to-br from-card/90 to-card/75
                    rounded-2xl
                    p-8
                    shadow-xl
                    border-2 border-border/50
                    backdrop-blur-sm
                    backdrop-invert-75
                    backdrop-brightness-50
                  `}
                >
                  <div className="max-h-40 overflow-y-auto">
                    {displayMode === "processing" ? (
                      <ShinyText
                        className="whitespace-pre-wrap"
                        speed={4}
                        text={inputText}
                      />
                    ) : displayMode === "playing" ? (
                      <ShinyText
                        className="whitespace-pre-wrap"
                        speed={8}
                        text={inputText}
                      />
                    ) : (
                      <p>{inputText}</p>
                    )}
                  </div>
                  {/* <div
                    className={`
                      text-xl md:text-2xl
                      leading-relaxed
                      tracking-wide
                      whitespace-pre-wrap
                      transition-all duration-300
                      ${displayMode === 'playing' ? 'animate-pulse-reading' : ''}
                    `}
                    style={{
                      fontFamily: 'var(--font-commissioner, system-ui)',
                    }}
                  >
                    {inputText}
                  </div> */}

                  {/* TODO: For playing state, user can add word-by-word highlighting animation */}
                  {/* Example: Split text by words, track current word index via audio timeupdate event */}
                </div>

                {/* Control Buttons for Ready/Playing States */}
                <div className="flex gap-3 flex-wrap">
                  {displayMode === "processing" ? (
                    <Button
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-600 text-white font-medium flex-1 sm:flex-none w-full"
                      size="lg"
                      onPress={() =>
                        logger.log("Speech Button logic", "Generating...")
                      }
                    >
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </Button>
                  ) : (
                    displayMode === "ready" && (
                      <>
                        <Button
                          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium flex-1 sm:flex-none"
                          size="lg"
                          onPress={handlePlay}
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Play Audio
                        </Button>
                        <Button
                          className="flex-1 sm:flex-none"
                          size="lg"
                          variant="flat"
                          onPress={handleEdit}
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Edit Text
                        </Button>
                      </>
                    )
                  )}

                  {displayMode === "playing" && (
                    <Button
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium flex-1 sm:flex-none"
                      size="lg"
                      onPress={handlePause}
                    >
                      <Pause className="w-5 h-5 mr-2" />
                      Pause
                    </Button>
                  )}

                  {(displayMode === "ready" || displayMode === "playing") && (
                    <>
                      <Button
                        className="flex-1 sm:flex-none"
                        size="lg"
                        variant="flat"
                        onPress={handleDownloadCurrent}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        className="flex-1 sm:flex-none"
                        size="lg"
                        variant="light"
                        onPress={handleClearCurrent}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear
                      </Button>
                    </>
                  )}
                </div>

                {/* Hidden Audio Element */}
                {currentAudioUrl && (
                  <div className="w-full h-fit max-h-14">
                    <audio
                      ref={currentAudioRef}
                      className="w-full h-full"
                      src={currentAudioUrl}
                      controls
                      onEnded={handleAudioEnded}
                      onPause={handleAudioPause}
                      onPlay={handleAudioPlay}
                    >
                      <track kind="captions" />
                    </audio>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audio History */}
          {audioHistory.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Recent Audio History</h2>
                <Button
                  className="text-destructive"
                  size="sm"
                  variant="light"
                  onPress={handleClearHistory}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>

              <div className="grid gap-3">
                {audioHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/50 hover:border-border transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-foreground line-clamp-2 flex-1">
                            {item.text}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>

                        {item.processed && (
                          <span className="inline-flex items-center text-xs text-purple-600 dark:text-purple-400">
                            Processed for speech
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="flat"
                        onPress={() => handleLoadHistoryItem(item)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Play
                      </Button>
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="flat"
                        onPress={() => handleDownloadHistoryItem(item)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        isIconOnly
                        className="text-destructive"
                        size="sm"
                        variant="light"
                        onPress={() => handleDeleteHistoryItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {audioHistory.length === 0 &&
            displayMode === "input" &&
            !isLoading && (
              <div className="bg-muted/30 backdrop-blur-sm rounded-xl p-6 border border-border/50 text-center">
                <Volume2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  No audio generated yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {`Enter some text above and click "Generate Speech" to create
                  audio. Your recent generations will appear here for easy
                  playback and download.`}
                </p>
              </div>
            )}
        </div>
      </div>

      <style>{`
        @keyframes pulse-reading {
          0%,
          100% {
            opacity: 1;
            color: inherit;
          }
          50% {
            opacity: 0.8;
            color: rgb(147, 51, 234);
          }
        }

        .animate-pulse-reading {
          animation: pulse-reading 2s ease-in-out infinite;
        }
      `}</style>
    </Page>
  );
}

function uint8ArrayToBlob(uint8ArrayData: Record<number, number>): Blob {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));

  return new Blob([uint8Array], { type: "audio/mpeg" });
}

{
  /* TODO: Add custom processing animation here */
}
{
  /* User can implement their own React-based text animation for processing state */
}
{
  /*{displayMode === "processing" ? (
  <div className="max-h-40 overflow-y-auto">
    <ScrollReveal
      baseOpacity={0}
      enableBlur={true}
      baseRotation={5}
      blurStrength={10}
    >
      <ShinyText
        text={inputText}
        className="whitespace-pre-wrap"
      />
    </ScrollReveal>
  </div>
) : (
  <div className="max-h-96 overflow-y-auto">
    <p className="text-lg md:text-xl leading-relaxed tracking-wide whitespace-pre-wrap transition-all duration-300">
      {inputText}
    </p>
  </div>
  // <ScrollReveal
  //   containerClassName="max-h-40 overflow-y-auto"
  //   baseOpacity={0}
  //   enableBlur={true}
  //   baseRotation={5}
  //   blurStrength={10}
  // >
  //   <p className="text-xl md:text-xl leading-relaxed tracking-wide whitespace-pre-wrap transition-all duration-300">
  //     {inputText}
  //   </p>
  // </ScrollReveal>
)}*/
}
