"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { ChatPageLoading } from "@/components/chat/chat-page-loading";
import { StartupLoading } from "@/components/layout/startup-loading";
import { Button } from "@/components/third-party/ui/button";
import { glass } from "@/components/design-system/primitives";

export function LoadingPagesLab() {
  const [preview, setPreview] = useState<"startup" | "chat">("startup");

  return (
    <div className="fixed inset-0 z-40 isolate h-dvh bg-background" data-loading-pages-lab>
      {preview === "startup" ? (
        <StartupLoading />
      ) : (
        <ChatPageLoading framed={false} markPerf={false} />
      )}
      <nav
        aria-label="Loading page previews"
        className={`${glass()} absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-20 mx-auto flex max-w-sm items-center justify-between gap-2 rounded-xl p-2`}
      >
        <Button asChild className="min-h-11 min-w-11" size="icon" variant="ghost">
          <Link aria-label="Back to prototypes" href="/sandbox/prototypes">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <Button
            aria-pressed={preview === "startup"}
            className="min-h-11"
            variant={preview === "startup" ? "secondary" : "ghost"}
            onClick={() => setPreview("startup")}
          >
            App startup
          </Button>
          <Button
            aria-pressed={preview === "chat"}
            className="min-h-11"
            variant={preview === "chat" ? "secondary" : "ghost"}
            onClick={() => setPreview("chat")}
          >
            Chat
          </Button>
        </div>
      </nav>
      <p className="pointer-events-none absolute inset-x-6 bottom-[calc(env(safe-area-inset-bottom,0px)+2rem)] z-10 text-center text-xs text-muted-foreground">
        Preview stays visible. Live loading ends as soon as the page is ready.
      </p>
    </div>
  );
}
