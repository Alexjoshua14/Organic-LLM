"use client";

import { UIMessage } from "ai";

import { ChatMessage } from "../chat/chat-message";

import { ScrollArea } from "@/components/third-party/ui/scroll-area";

type PrometheusResponseProps = {
  response: UIMessage;
  isLoading: boolean;
};

export const PrometheusResponse: React.FC<PrometheusResponseProps> = ({
  response,
  isLoading,
}) => {
  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-1 rounded-3xl backdrop-blur-xl border overflow-hidden shadow-2xl"
        style={{
          background: "rgba(247, 243, 233, 0.05)",
          borderColor: "rgba(156, 175, 136, 0.2)",
          boxShadow: `
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.05)
          `,
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-light tracking-wide text-foreground/90">
              Response
            </h3>
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-foreground/60">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="font-light">Processing...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              {response ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div
                    className="text-foreground/80 leading-relaxed font-light whitespace-pre-wrap"
                    style={{
                      fontFamily:
                        "var(--font-commissioner), system-ui, sans-serif",
                      lineHeight: "1.7",
                    }}
                  >
                    <ChatMessage message={response} />
                  </div>
                  {isLoading && (
                    <div className="mt-2">
                      <div className="inline-block w-1 h-4 bg-foreground/60 animate-pulse" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center text-foreground/40">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-[#9CAF88] to-[#C4A484] opacity-20 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-white/30" />
                    </div>
                    <p className="text-sm font-light">Awaiting your query...</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer - Subtle organic accent */}
        <div className="p-4 border-t border-white/5">
          <div
            className="h-1 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(156, 175, 136, 0.3) 50%, transparent 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
};
