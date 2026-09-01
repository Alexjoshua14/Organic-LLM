"use client";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { glass } from "@/components/design-system/primitives";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewUrl,
} from "@/components/third-party/ai-elements/web-preview";
import { cn } from "@/lib/utils";

type GenUiInstance = {
  instanceId: string;
  block: unknown;
  remountKey: number;
};

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

  return (
    <aside
      className={cn(
        glass({ border: "all" }),
        "flex max-h-[45vh] min-h-0 w-full flex-col gap-3 overflow-y-auto border-t p-4 lg:max-h-none lg:w-[min(42%,28rem)] lg:border-l lg:border-t-0"
      )}
    >
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">Visual channel</p>

      {showWeb && webPreview ? (
        <div className="flex min-h-[16rem] flex-col overflow-hidden rounded-xl border border-white/10">
          {webPreview.title ? (
            <p className="border-b border-white/10 px-3 py-2 text-xs text-foreground/80">
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
          <div
            key={`${item.instanceId}-${item.remountKey}`}
            className="rounded-xl border border-white/10 bg-black/20 p-2"
          >
            <p className="mb-2 font-mono text-2xs text-muted-foreground">{item.instanceId}</p>
            <GenUIRenderer data={{ block: item.block }} messageId={item.instanceId} />
          </div>
        ))
        : null}

      {surfaces.map(([surfaceId, items]) => (
        <div key={surfaceId} className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-2xs uppercase tracking-wide text-muted-foreground">
            State · {surfaceId}
          </p>
          <ul className="space-y-1 text-xs text-foreground/80">
            {items.map((item) => (
              <li key={item.id} className="font-mono">
                {item.id}: {JSON.stringify(item.data)}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {!webPreview && genUiBlocks.length === 0 && surfaces.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          When the agent uses GenUI or web tools, they appear here.
        </p>
      ) : null}
    </aside>
  );
}
