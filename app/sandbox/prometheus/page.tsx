"use client";

import { useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { PrometheusInput, PrometheusResponse } from "@/components/prometheus";
import Page from "@/components/layout/page";

export default function PrometheusPage() {
  const [isLoading, setIsLoading] = useState(false);

  const PROMETHEUS_PROJECT = process.env.NEXT_PUBLIC_PROMETHEUS_PROJECT;

  const { messages, sendMessage } = useChat({
    id: PROMETHEUS_PROJECT,
    transport: new DefaultChatTransport({
      api: "/api/chat/prometheus",
    }),
  });

  const handleSendMessage = useCallback(async ({ text }: { text: string }) => {
    setIsLoading(true);
    try {
      sendMessage({
        text: text,
      });
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <Page>
      {/* Main Content Container */}
      <div className="relative w-full h-screen flex flex-col">
        {/* Large Title - 10 characters take up full VW */}
        <div className="flex-shrink-0 pt-8 pb-6 px-8 w-full flex items-center justify-center">
          <h1
            className="font-commissioner font-light tracking-[-0.02em] leading-none"
            style={{
              fontSize: "7vw",
              color: "rgba(255, 255, 255, 0.9)",
              textShadow: "0 2px 20px rgba(0, 0, 0, 0.1)",
            }}
          >
            PROMETHEUS
          </h1>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center w-full px-8 gap-8 min-h-0 pb-4">
          {/* 3D Renderer Placeholder - 4:5 aspect ratio */}
          <div className="flex-1 flex items-center justify-center">
            <div
              className="rounded-3xl shadow-2xl overflow-hidden border border-white/10"
              style={{
                width: "min(33vh * 0.8, 40vw)",
                height: "33vh",
                background: "var(--gradient-forest)",
                boxShadow: `
                  0 20px 25px -5px rgba(0, 0, 0, 0.1),
                  0 10px 10px -5px rgba(0, 0, 0, 0.04),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1)
                `,
              }}
            >
              {/* Organic geometric pattern overlay */}
              <div className="w-full h-full relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  {/* Subtle organic pattern */}
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-white/10 blur-xl" />
                  <div className="absolute top-3/4 right-1/4 w-24 h-24 rounded-full bg-white/10 blur-lg" />
                  <div className="absolute bottom-1/4 left-1/3 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
                </div>

                {/* Center placeholder text */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white/80">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <div className="w-8 h-8 rounded-full bg-white/30" />
                    </div>
                    <p className="text-sm font-light tracking-wide">
                      3D RENDERER
                    </p>
                    <p className="text-xs opacity-60 mt-1">PLACEHOLDER</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Response Area - Takes up remaining space, only shows when there's a response */}
          <div className="flex-1 max-w-[45vw] min-w-[350px] flex items-start w-full">
            <div className="w-full h-full max-h-[70vh]">
              <PrometheusResponse
                isLoading={isLoading}
                response={messages[messages.length - 1]}
              />
            </div>
          </div>

        </div>
        {/* Input Area - Fixed at bottom */}
        <div className="flex-shrink-0">
          <PrometheusInput onSendMessage={handleSendMessage} />
        </div>
      </div>
    </Page>
  );
}



// :root {
//   /* Organic Earth Tones - Warm, Natural */
//   --organic - sage: #9caf88;
//   --organic - clay: #c4a484;
//   --organic - stone: #a8a196;
//   --organic - moss: #7b8471;
//   --organic - cream: #f7f3e9;
//   --organic - charcoal: #2d2b26;
//   --organic - mist: #e8e5db;
//   --organic - bark: #5d4e37;

//   /* Modern Organic Gradients */
//   --gradient - earth: linear - gradient(
//     135deg,
//             #9caf88 0 %,
//     #c4a484 50 %,
//     #a8a196 100 %
//           );
//   --gradient - forest: linear - gradient(135deg, #7b8471 0 %, #9caf88 100 %);
//   --gradient - dawn: linear - gradient(135deg, #f7f3e9 0 %, #e8e5db 100 %);
//   --gradient - dusk: linear - gradient(135deg, #5d4e37 0 %, #2d2b26 100 %);
// }

//         .dark {
//   /* Dark mode organic variants */
//   --organic - sage: #6b7a5a;
//   --organic - clay: #8b6f56;
//   --organic - stone: #6b6960;
//   --organic - moss: #4a5142;
//   --organic - cream: #2a2822;
//   --organic - charcoal: #1a1916;
//   --organic - mist: #2f2d28;
//   --organic - bark: #3d3426;