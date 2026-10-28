import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { useMorphFlip } from "@/hooks/use-morph-flip";
import { COMPOSER_SHIFT_MIN_PX, COMPOSER_SHIFT_SPRING } from "@/lib/chat/composer-shift-spring";

function ComposerResizeHarness() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const composer = useRef<HTMLDivElement>(null);

  useMorphFlip(composer, "dashboard:chat:board", {
    spring: COMPOSER_SHIFT_SPRING,
    minShiftPx: COMPOSER_SHIFT_MIN_PX,
  });

  return (
    <>
      <button id="toggle-sidebar" onClick={() => setSidebarOpen((open) => !open)}>
        Toggle sidebar
      </button>
      <div className="app" data-sidebar-open={sidebarOpen}>
        <aside className="sidebar-gap" />
        <section className="page">
          <div className="dashboard">
            <div className="chat-viewport">
              <div className="chat">
                <p>Conversation content</p>
                <div className="composer-inset">
                  <div ref={composer} className="composer" data-composer>
                    <textarea defaultValue="Unsent draft" />
                    <div className="controls">
                      <button>Search</button>
                      <button>Memory</button>
                      <button>Model</button>
                      <button className="send">Send</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="board">Subagent board</div>
          </div>
        </section>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<ComposerResizeHarness />);
