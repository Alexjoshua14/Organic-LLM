export interface WebSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: WebSpeechRecognition, ev: Event) => void) | null;
  onend: ((this: WebSpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: WebSpeechRecognition, ev: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((this: WebSpeechRecognition, ev: WebSpeechRecognitionErrorEvent) => void) | null;
}

export interface WebSpeechRecognitionEvent extends Event {
  results: WebSpeechRecognitionResultList;
  resultIndex: number;
}

export type WebSpeechRecognitionResultList = {
  readonly length: number;
  item(index: number): WebSpeechRecognitionResult;
  [index: number]: WebSpeechRecognitionResult;
};

export type WebSpeechRecognitionResult = {
  readonly length: number;
  item(index: number): WebSpeechRecognitionAlternative;
  [index: number]: WebSpeechRecognitionAlternative;
  isFinal: boolean;
};

export type WebSpeechRecognitionAlternative = {
  transcript: string;
  confidence: number;
};

export interface WebSpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): WebSpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): WebSpeechRecognition;
    };
  }
}

export function getWebSpeechRecognitionCtor(): (new () => WebSpeechRecognition) | null {
  if (typeof window === "undefined") return null;

  const { SpeechRecognition, webkitSpeechRecognition } = window;
  return SpeechRecognition ?? webkitSpeechRecognition ?? null;
}
