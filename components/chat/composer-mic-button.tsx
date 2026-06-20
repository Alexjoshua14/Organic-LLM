"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { MicIcon } from "lucide-react";

import { getWebSpeechRecognitionCtor, type WebSpeechRecognition } from "@/lib/web-speech-recognition";

import { ComposerActionButton } from "./composer-action-button";

export type ComposerMicButtonProps = {
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onTranscriptionChange?: (text: string) => void;
};

export function ComposerMicButton({ textareaRef, onTranscriptionChange }: ComposerMicButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<WebSpeechRecognition | null>(null);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor = getWebSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    const speechRecognition = new SpeechRecognitionCtor();

    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = "en-US";

    speechRecognition.onstart = () => {
      setIsListening(true);
    };

    speechRecognition.onend = () => {
      setIsListening(false);
    };

    speechRecognition.onresult = (event) => {
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? "";
        }
      }

      if (finalTranscript && textareaRef?.current) {
        const textarea = textareaRef.current;
        const currentValue = textarea.value;
        const newValue = currentValue + (currentValue ? " " : "") + finalTranscript;

        textarea.value = newValue;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        onTranscriptionChange?.(newValue);
      }
    };

    speechRecognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current = speechRecognition;
    setRecognition(speechRecognition);

    return () => {
      recognitionRef.current?.stop();
    };
  }, [textareaRef, onTranscriptionChange]);

  const toggleListening = useCallback(() => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }, [recognition, isListening]);

  return (
    <ComposerActionButton
      engaged={isListening}
      rimPulse={isListening}
      aria-label={isListening ? "Stop dictation" : "Dictate message"}
      aria-pressed={isListening}
      disabled={!recognition}
      title={isListening ? "Stop dictation" : "Dictate message"}
      onClick={toggleListening}
    >
      <MicIcon className="size-4" />
    </ComposerActionButton>
  );
}
