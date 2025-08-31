"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Volume2, Loader2 } from "lucide-react";

import Page from "@/components/layout/page";
import { TTSButton } from "@/components/tts/ttsButton";

export default function TTSPage() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) {
      setError("Please enter a message");

      return;
    }

    setIsLoading(true);
    setError("");
    setResponse("");

    try {
      const res = await fetch("/api/ai/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input }),
      });

      if (!res.ok) {
        const errorData = await res.json();

        throw new Error(
          errorData.error || "Failed to generate speech-friendly response",
        );
      }

      const data = await res.json();

      setResponse(data.text);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <Page>
      <div className="w-full max-w-4xl mx-auto p-6 h-full overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
            Text-to-Speech Sandbox
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Generate speech-friendly responses optimized for text-to-speech
            playback
          </p>
        </div>

        {/* Input Section */}
        <div className="mb-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                htmlFor="message-input"
              >
                Your Message
              </label>
              <Textarea
                classNames={{
                  input: ["bg-transparent"],
                  inputWrapper: [
                    "border-gray-300",
                    "dark:border-gray-700",
                    "hover:border-gray-400",
                    "dark:hover:border-gray-600",
                    "focus-within:border-purple-500",
                    "dark:focus-within:border-purple-400",
                  ],
                }}
                id="message-input"
                maxRows={6}
                minRows={3}
                placeholder="Ask me anything, and I'll respond in a way that sounds great when spoken aloud..."
                value={input}
                onKeyDown={handleKeyDown}
                onValueChange={setInput}
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              disabled={isLoading || !input.trim()}
              size="lg"
              type="submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Speech-Friendly Response...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-2" />
                  Generate Speech Response
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Response Section */}
        {response && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Speech-Friendly Response
              </h3>
              <TTSButton text={response} />
            </div>

            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {response}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 This response has been optimized for text-to-speech playback
                with natural pacing and speech-friendly formatting.
              </p>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            About Speech-Friendly Responses
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <li>
              • Responses are optimized for natural speech rhythm and flow
            </li>
            <li>
              • Special characters and formatting are avoided or converted to
              speech-friendly alternatives
            </li>
            <li>• Acronyms are spelled out for better pronunciation</li>
            <li>
              • Sentence length and structure are optimized for listening
              comprehension
            </li>
            <li>• Ready for integration with text-to-speech functionality</li>
          </ul>
        </div>
      </div>
    </Page>
  );
}
