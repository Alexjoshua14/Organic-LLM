"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { stageRequest } from "./use-stage";

type Check = { embeddable: boolean; host: string; title: string | null };

// A framed page is laid out at least this wide and scaled down to its cell, so it keeps its
// desktop layout and reads near the stage's own text size. The floor keeps its text legible.
const WEB_LAYOUT_WIDTH = 920;
const WEB_MIN_SCALE = 0.7;
// Slow third-party resources can hold a page's load event for seconds. Show it by then anyway.
const WEB_REVEAL_MS = 1200;

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Frames the page when its own headers allow it. The browser reports nothing when a site refuses
 * framing (the frame still "loads"), so the server checks first and a refusing page becomes a
 * quiet card instead of a blank pane. If the check itself can't run, the frame is tried anyway.
 * The heading and surface hold their place from the first paint; the page fades in over them.
 */
export function StageWeb({ url, title }: { url: string; title: string }) {
  const [check, setCheck] = useState<Check | "pending" | "unknown">("pending");
  const [shown, setShown] = useState(false);
  const [scale, setScale] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const refused = typeof check === "object" && !check.embeddable;
  const framed = check !== "pending" && !refused;
  const host = typeof check === "object" ? check.host : hostOf(url);

  useEffect(() => {
    let current = true;

    setCheck("pending");
    setShown(false);
    stageRequest<Check>(`/api/stage/web-check?url=${encodeURIComponent(url)}`)
      .then((result) => current && setCheck(result))
      .catch(() => current && setCheck("unknown"));

    return () => {
      current = false;
    };
  }, [url]);

  useEffect(() => {
    if (!framed) return;
    const timer = window.setTimeout(() => setShown(true), WEB_REVEAL_MS);

    return () => window.clearTimeout(timer);
  }, [framed, url]);

  useEffect(() => {
    const element = viewport.current;

    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(Math.min(1, Math.max(WEB_MIN_SCALE, entry.contentRect.width / WEB_LAYOUT_WIDTH)))
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [refused]);

  return (
    <div className="stage-web" data-state={refused ? "refused" : shown ? "ready" : "loading"}>
      <header className="stage-web-source">
        <h2>{title}</h2>
        <span>{host}</span>
      </header>
      {refused ? (
        <div className="stage-web-card">
          <p className="stage-muted">This site doesn’t allow being shown inside another page.</p>
          <a href={url} rel="noopener noreferrer" target="_blank">
            Open in a new tab
          </a>
        </div>
      ) : (
        <div ref={viewport} className="stage-web-viewport">
          {!shown && <p className="stage-muted stage-web-wait">Opening {host}…</p>}
          {framed && (
            <iframe
              className="stage-web-frame"
              style={{ "--stage-web-scale": scale } as CSSProperties}
              title={title}
              src={url}
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => setShown(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
