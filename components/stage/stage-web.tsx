"use client";

import { useEffect, useState } from "react";

import { stageRequest } from "./use-stage";

type Check = { embeddable: boolean; host: string; title: string | null };

/**
 * Frames the page when its own headers allow it. The browser reports nothing when a site refuses
 * framing (the frame still "loads"), so the server checks first and a refusing page becomes a
 * quiet card instead of a blank pane. If the check itself can't run, the frame is tried anyway.
 */
export function StageWeb({ url, title }: { url: string; title: string }) {
  const [check, setCheck] = useState<Check | "pending" | "unknown">("pending");

  useEffect(() => {
    let current = true;

    setCheck("pending");
    stageRequest<Check>(`/api/stage/web-check?url=${encodeURIComponent(url)}`)
      .then((result) => current && setCheck(result))
      .catch(() => current && setCheck("unknown"));

    return () => {
      current = false;
    };
  }, [url]);

  if (check === "pending") return <p className="stage-muted">Opening page…</p>;
  if (check !== "unknown" && !check.embeddable)
    return (
      <div className="stage-web-card">
        <p className="stage-web-card-host">{check.host}</p>
        <p className="stage-web-card-title">{check.title ?? title}</p>
        <p className="stage-muted">This site doesn’t allow being shown inside another page.</p>
        <a href={url} rel="noopener noreferrer" target="_blank">
          Open in a new tab
        </a>
      </div>
    );

  return (
    <iframe
      className="stage-web-frame"
      title={title}
      src={url}
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
    />
  );
}
