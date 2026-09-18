"use client";

import type { ComponentProps } from "react";
import type { ChatModel } from "@/lib/schemas/chat";
import type { ChatEffortLevel } from "@/lib/schemas/chat-effort";
import type { ProductLabState } from "../_lib/lab-state";
import type { SimulatedChat } from "../_lib/use-simulated-chat";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { LAB_THREAD } from "../_lib/lab-messages";
import { LAB_COMPOSER_PREF_KEYS } from "../_lib/lab-state";

import { CoreInput } from "@/components/chat/core-input";
import {
  isInCoreInputHysteresisBand,
  resolveCoreInputLayoutMode,
} from "@/components/chat/core-input/layout-breakpoints";
import { glass } from "@/components/design-system/primitives";
import { DEFAULT_COMPOSER_EFFORT, DEFAULT_COMPOSER_MODEL } from "@/lib/chat/composer-tool-defaults";
import { cn } from "@/lib/utils";

type CoreInputProps = ComponentProps<typeof CoreInput>;

/** The caller-owned refs only change when the composer renders; a light poll keeps the readout honest. */
const REF_READOUT_POLL_MS = 300;

type SendPayloadReadout = {
  modelName: string;
  effort: ChatEffortLevel;
  webSearch: boolean;
  memories: boolean;
  speechFriendly: boolean;
};

type ProductStageProps = {
  state: ProductLabState;
  chat: SimulatedChat;
  /** Bump to unmount and remount the composer (re-reads prefs, replays mount effects). */
  remountKey: number;
};

/** The shipped `CoreInput` on a width-controlled stage, with the refs it writes read back out. */
export function ProductStage({ state, chat, remountKey }: ProductStageProps) {
  const modelRef = useRef<ChatModel>(DEFAULT_COMPOSER_MODEL);
  const effortRef = useRef<ChatEffortLevel>(DEFAULT_COMPOSER_EFFORT);
  const useWebSearchRef = useRef(false);
  const useMemoriesRef = useRef(true);
  const useSpeechFriendlyRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [shellWidthPx, setShellWidthPx] = useState<number | null>(null);
  const [payload, setPayload] = useState<SendPayloadReadout | null>(null);

  // Same element CoreInput measures for its own breakpoints.
  useLayoutEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const shell = stage.querySelector<HTMLElement>("[data-prompt-input-shell]");

    if (!shell) return;

    const apply = () => setShellWidthPx(Math.round(shell.getBoundingClientRect().width));

    apply();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(apply);

    observer.observe(shell);

    return () => observer.disconnect();
  }, [remountKey]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next: SendPayloadReadout = {
        modelName: modelRef.current.name,
        effort: effortRef.current,
        webSearch: useWebSearchRef.current,
        memories: useMemoriesRef.current,
        speechFriendly: useSpeechFriendlyRef.current,
      };

      setPayload((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }, REF_READOUT_POLL_MS);

    return () => window.clearInterval(id);
  }, []);

  const layoutMode =
    shellWidthPx == null ? null : resolveCoreInputLayoutMode(shellWidthPx, state.variant);
  const inBand =
    shellWidthPx != null &&
    state.variant === "default" &&
    isInCoreInputHysteresisBand(shellWidthPx);

  return (
    <div className="space-y-4">
      {/* Vertical room for the outline offset and the lumen rim's bleed. */}
      <div className="py-3 sm:py-4">
        <div
          ref={stageRef}
          className={cn(
            "relative mx-auto w-full",
            state.showStageBounds &&
              "rounded-xl outline-1 outline-dashed outline-border/50 outline-offset-8"
          )}
          style={{ maxWidth: state.stageWidthPx }}
        >
          {state.showThread ? <ThreadPreview /> : null}
          <CoreInput
            key={remountKey}
            clearError={chat.clearError}
            defaultEffort={DEFAULT_COMPOSER_EFFORT}
            defaultModel={DEFAULT_COMPOSER_MODEL}
            disabled={state.disabled}
            effortLocalStorageKey={LAB_COMPOSER_PREF_KEYS.effort}
            effortRef={effortRef}
            enableMarkdownInputPreview={state.enableMarkdownInputPreview}
            error={chat.error}
            experience={state.experience === "none" ? undefined : state.experience}
            featureHints={state.featureHints}
            hideWebMemorySpeechToggles={state.hideWebMemorySpeechToggles}
            memoryLocalStorageKey={LAB_COMPOSER_PREF_KEYS.memories}
            modelLocalStorageKey={LAB_COMPOSER_PREF_KEYS.model}
            modelRef={modelRef}
            secondarySubmitPending={state.steerPending}
            sendMessage={chat.sendMessage as CoreInputProps["sendMessage"]}
            sentMessageShimmer={state.sentMessageShimmer}
            showContextBudget={state.showContextBudget}
            status={chat.status}
            stop={chat.stop}
            submitVariant={state.submitVariant}
            useMemoriesRef={useMemoriesRef}
            useSpeechFriendlyRef={state.speechChip ? useSpeechFriendlyRef : undefined}
            useWebSearchRef={useWebSearchRef}
            variant={state.variant}
            onSecondarySubmit={state.steerButton ? chat.recordSteer : undefined}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Readout label="Shell" value={shellWidthPx == null ? "—" : `${shellWidthPx}px`} />
        <Readout
          label="Layout"
          tone={inBand ? "warn" : "default"}
          value={layoutMode ? (inBand ? `${layoutMode} · in band` : layoutMode) : "—"}
        />
        <Readout label="Status" value={chat.status} />
        <Readout label="Model" value={payload?.modelName ?? "—"} />
        <Readout label="Effort" value={payload?.effort ?? "—"} />
        <Readout label="Search" value={onOff(payload?.webSearch)} />
        <Readout label="Memory" value={onOff(payload?.memories)} />
        <Readout label="Speech" value={onOff(payload?.speechFriendly)} />
        <Readout
          label={chat.lastSend?.kind === "steer" ? "Last steer" : "Last send"}
          value={
            chat.lastSend
              ? `“${truncate(chat.lastSend.text, 36)}”${
                  chat.lastSend.fileCount ? ` +${chat.lastSend.fileCount} file(s)` : ""
                }`
              : "—"
          }
        />
      </div>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        Layout is derived from the shell width using the composer&apos;s own breakpoints. Inside the
        hysteresis band the live mode depends on which side you resized from, so treat it as
        approximate there. The other values are read from the refs the composer writes — the same
        values a real send would post.
      </p>
    </div>
  );
}

function onOff(value: boolean | undefined): string {
  if (value == null) return "—";

  return value ? "on" : "off";
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();

  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function Readout({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/50 bg-background/40 px-2 py-1 text-2xs">
      <span className="shrink-0 uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className={cn(
          "truncate font-mono",
          tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-foreground"
        )}
      >
        {value}
      </span>
    </span>
  );
}

/** Placeholder thread so the composer sits under messages, as it does on a chat page. */
function ThreadPreview() {
  return (
    <div className="flex w-full flex-col gap-6 px-1 pb-6 pt-2">
      {LAB_THREAD.map((message) =>
        message.role === "user" ? (
          <div key={message.id} className="max-w-4/5 w-fit self-end overflow-hidden">
            <div className={cn(glass(), "rounded-lg p-4")}>
              <p className="text-sm leading-6 text-foreground">{message.text}</p>
            </div>
          </div>
        ) : (
          <div key={message.id} className="max-w-[88%] rounded-lg p-4">
            <p className="text-sm leading-6 text-foreground">{message.text}</p>
          </div>
        )
      )}
    </div>
  );
}
