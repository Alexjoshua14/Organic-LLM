"use client";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewUrl,
} from "@/components/third-party/ai-elements/web-preview";

type GenUiInstance = {
  instanceId: string;
  block: unknown;
  remountKey: number;
};

/**
 * Supporting evidence for the call: cards and web pages. Rendered inside the stage's side
 * panel. Speech carries the conversation; this carries the evidence
 * (`docs/speak/tool-behavior.md`, principle 1).
 */
export function SpeakVisualPanel({
  showGenUi,
  showWeb,
  genUiBlocks,
  webPreview,
  uiStateBySurface,
}: {
  showGenUi: boolean;
  showWeb: boolean;
  genUiBlocks: GenUiInstance[];
  webPreview: { url: string; title?: string } | null;
  uiStateBySurface: Record<string, Array<{ id: string; data: Record<string, unknown> }>>;
}) {
  const surfaces = Object.entries(uiStateBySurface);
  const empty =
    !(showWeb && webPreview) && !(showGenUi && genUiBlocks.length > 0) && surfaces.length === 0;

  if (empty) {
    return (
      <p className="py-stack-3xl text-center text-sm text-muted-foreground">
        Cards and pages Organic shows you during the call appear here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-stack-md">
      {showWeb && webPreview ? (
        <div className="flex min-h-[16rem] flex-col overflow-hidden rounded-2xl border border-border/50">
          {webPreview.title ? (
            <p className="border-b border-border/50 px-inset-md py-2 text-xs text-foreground/80">
              {webPreview.title}
            </p>
          ) : null}
          <WebPreview className="min-h-[14rem] flex-1 border-0" defaultUrl={webPreview.url}>
            <WebPreviewNavigation>
              <WebPreviewUrl />
            </WebPreviewNavigation>
            <WebPreviewBody />
          </WebPreview>
        </div>
      ) : null}

      {showGenUi
        ? genUiBlocks.map((item) => (
            <div key={`${item.instanceId}-${item.remountKey}`} className="min-w-0">
              <GenUIRenderer data={{ block: item.block }} messageId={item.instanceId} />
            </div>
          ))
        : null}

      {surfaces.map(([surfaceId, items]) => (
        <div
          key={surfaceId}
          className="rounded-2xl border border-border/50 bg-background/40 p-inset-md"
        >
          <p className="mb-stack-xs text-2xs uppercase tracking-wide text-muted-foreground">
            {surfaceId}
          </p>
          <ul className="space-y-stack-xs text-xs text-foreground/80">
            {items.map((item) => (
              <li key={item.id} className="break-words font-mono">
                {item.id}: {JSON.stringify(item.data)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
