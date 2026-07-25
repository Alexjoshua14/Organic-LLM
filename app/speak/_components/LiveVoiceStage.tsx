"use client";

import { useEffect, useMemo, useState } from "react";

import { Loader2, Mic, PhoneOff, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { KaraokeCaption } from "./KaraokeCaption";
import { SpeakBudgetChip } from "./SpeakBudgetChip";
import { SpeakModalityToggles } from "./SpeakModalityToggles";
import { SpeakVisualPanel } from "./SpeakVisualPanel";
import { VoicePresenceOrb } from "./VoicePresenceOrb";

import { glass } from "@/components/design-system/primitives";
import { useRealtimeVoice } from "@/hooks/use-realtime-voice";
import {
  DEFAULT_SPEAK_MODALITIES,
  type SpeakModalities,
} from "@/lib/schemas/speak-modalities";
import type { SpeakToolClientEffect } from "@/lib/speak/types";
import { cn } from "@/lib/utils";

type CaptionState = {
  role: "user" | "assistant" | "system";
  text: string;
  interim?: boolean;
};

type GenUiInstance = {
  instanceId: string;
  block: unknown;
  remountKey: number;
};

export function LiveVoiceStage({ onExit }: { onExit?: () => void }) {
  const [modalities, setModalities] = useState<SpeakModalities>(DEFAULT_SPEAK_MODALITIES);
  const [caption, setCaption] = useState<CaptionState>({ role: "system", text: "" });
  const [displayText, setDisplayText] = useState<string | null>(null);
  const [webPreview, setWebPreview] = useState<{ url: string; title?: string } | null>(null);
  const [genUiBlocks, setGenUiBlocks] = useState<GenUiInstance[]>([]);
  const [uiStateBySurface, setUiStateBySurface] = useState<
    Record<string, Array<{ id: string; data: Record<string, unknown> }>>
  >({});

  const applyEffects = (effects: SpeakToolClientEffect[]) => {
    for (const effect of effects) {
      switch (effect.type) {
        case "display_text":
          setDisplayText(effect.text);
          setCaption({ role: "assistant", text: effect.text });
          break;
        case "gen_ui":
          setGenUiBlocks((prev) => {
            const existing = prev.find((b) => b.instanceId === effect.instanceId);

            if (existing) {
              return prev.map((b) =>
                b.instanceId === effect.instanceId
                  ? { instanceId: effect.instanceId, block: effect.block, remountKey: b.remountKey + 1 }
                  : b
              );
            }

            return [
              ...prev,
              { instanceId: effect.instanceId, block: effect.block, remountKey: 0 },
            ];
          });
          break;
        case "refresh_component":
          setGenUiBlocks((prev) =>
            prev.map((b) =>
              b.instanceId === effect.instanceId
                ? { ...b, remountKey: b.remountKey + 1 }
                : b
            )
          );
          break;
        case "upsert_ui_state":
          setUiStateBySurface((prev) => {
            const current = prev[effect.surfaceId] ?? [];
            const byId = new Map(current.map((i) => [i.id, i]));

            for (const item of effect.items) {
              byId.set(item.id, item);
            }

            return { ...prev, [effect.surfaceId]: Array.from(byId.values()) };
          });
          break;
        case "web_preview":
          setWebPreview({ url: effect.url, title: effect.title });
          break;
        default:
          break;
      }
    }
  };

  const voice = useRealtimeVoice({
    modalities,
    onCaptionChange: setCaption,
    onClientEffects: applyEffects,
  });

  const showVisualPanel =
    modalities.genUi || modalities.web || Object.keys(uiStateBySurface).length > 0;

  const statusHint = useMemo(() => {
    if (voice.connecting) return "Connecting…";
    if (voice.connected) {
      switch (voice.phase) {
        case "listening":
          return "Listening — keep talking or pause";
        case "speaking":
          return "Speaking — interrupt anytime";
        default:
          return "Connected — speak naturally";
      }
    }

    return "Tap the mic to start a Realtime voice session";
  }, [voice.connected, voice.connecting, voice.phase]);

  useEffect(() => {
    if (!voice.connected && !caption.text) {
      setCaption({
        role: "system",
        text: "Realtime voice — optional text, GenUI, and web previews via the toggles above.",
      });
    }
  }, [caption.text, voice.connected]);

  const captionText = displayText && modalities.text ? displayText : caption.text;
  const showText = modalities.text;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-start justify-between gap-3">
        <SpeakModalityToggles
          disabled={voice.connected || voice.connecting}
          value={modalities}
          onChange={setModalities}
        />
        <SpeakBudgetChip budget={voice.budget} />
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1",
          showVisualPanel ? "flex-col lg:flex-row" : "flex-col"
        )}
      >
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-16">
          <audio
            ref={(el) => voice.setAudioElement(el)}
            className="hidden"
            autoPlay
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={voice.phase + String(voice.connected)}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-8"
              exit={{ opacity: 0.6, scale: 0.98 }}
              initial={{ opacity: 0.7, scale: 0.96 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <VoicePresenceOrb phase={voice.phase} />

              {showText ? (
                <div className="min-h-[5rem] w-full max-w-3xl">
                  <KaraokeCaption
                    interim={caption.interim}
                    role={caption.role}
                    text={captionText}
                  />
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <p className="mt-6 text-xs text-muted-foreground">{statusHint}</p>

          {voice.error ? (
            <p className="mt-2 max-w-md text-center text-xs text-destructive">{voice.error}</p>
          ) : null}

          <div className="mt-10 flex items-center gap-4">
            {!voice.connected ? (
              <button
                aria-label="Start Realtime voice"
                className={cn(
                  glass({ opaque: true, border: "all" }),
                  "flex size-20 items-center justify-center rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg"
                )}
                disabled={voice.connecting}
                type="button"
                onClick={() => void voice.connect()}
              >
                {voice.connecting ? (
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                ) : (
                  <Mic className="size-8 text-foreground" />
                )}
              </button>
            ) : (
              <button
                aria-label="End Realtime session"
                className={cn(
                  glass({ opaque: true, border: "all" }),
                  "flex size-20 items-center justify-center rounded-full border-rose-400/50 bg-rose-500/15 shadow-[0_0_40px_rgba(244,63,94,0.2)]"
                )}
                type="button"
                onClick={() => void voice.disconnect()}
              >
                <PhoneOff className="size-8 text-rose-200" />
              </button>
            )}

            <button
              aria-label="Reset voice session"
              className={cn(
                glass(),
                "flex size-12 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              )}
              type="button"
              onClick={() => {
                void voice.resetSession();
                setDisplayText(null);
                setWebPreview(null);
                setGenUiBlocks([]);
                setUiStateBySurface({});
              }}
            >
              <RotateCcw className="size-4" />
            </button>
          </div>

          {modalities.text && voice.transcript.length > 0 ? (
            <div className="mt-8 max-h-40 w-full max-w-xl overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-left text-xs text-muted-foreground">
              {voice.transcript.map((t) => (
                <p key={t.id} className="mb-1">
                  <span className="font-medium text-foreground/80">{t.role}: </span>
                  {t.text}
                </p>
              ))}
            </div>
          ) : null}

          {onExit ? (
            <button
              className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              type="button"
              onClick={onExit}
            >
              Read text aloud instead
            </button>
          ) : null}
        </div>

        {showVisualPanel ? (
          <SpeakVisualPanel
            genUiBlocks={genUiBlocks}
            showGenUi={modalities.genUi}
            showWeb={modalities.web}
            uiStateBySurface={uiStateBySurface}
            webPreview={webPreview}
          />
        ) : null}
      </div>
    </div>
  );
}
