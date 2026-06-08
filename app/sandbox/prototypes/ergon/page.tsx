"use client";

import type { KanbanView as KanbanViewType } from "@/lib/schemas/kanban";

import { useState } from "react";

import { ChatStylePicker } from "@/components/chat/chat-style-picker";
import { KanbanView } from "@/components/chat/kanban/KanbanView";
import { applyKanbanCommand, resetKanbanBoard, useKanbanBoard } from "@/lib/kanban/store";
import {
  FIXTURE_INITIATE,
  FIXTURE_SHOW_ACTIVE_VIEW,
  FIXTURE_SHOW_NEXT_UP_VIEW,
  FIXTURE_UPSERT,
} from "@/lib/schemas/kanban/fixtures";

const SANDBOX_THREAD_ID = "sandbox-ergon";

const BOARD_VIEW: KanbanViewType = {
  id: "view-board",
  title: "Full board",
  intent: "board",
  groupBy: "status",
};

export default function ErgonPrototypePage() {
  const board = useKanbanBoard(SANDBOX_THREAD_ID);
  const [activeView, setActiveView] = useState<KanbanViewType>(BOARD_VIEW);

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Ergon board (kanban puppet)</h1>
        <p className="text-sm text-muted-foreground">
          Drives the client-side kanban store directly (no API). Step through the puppet command
          sequence and summon saved views.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Chat style picker</h2>
        <ChatStylePicker chatId={SANDBOX_THREAD_ID} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Puppet commands</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent/40"
            onClick={() => applyKanbanCommand(SANDBOX_THREAD_ID, FIXTURE_INITIATE)}
          >
            1. INITIATE (loading shell)
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent/40"
            onClick={() => applyKanbanCommand(SANDBOX_THREAD_ID, FIXTURE_UPSERT)}
          >
            2. UPSERT items (hydrate)
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent/40"
            onClick={() => {
              applyKanbanCommand(SANDBOX_THREAD_ID, FIXTURE_SHOW_ACTIVE_VIEW);
              setActiveView(FIXTURE_SHOW_ACTIVE_VIEW.view);
            }}
          >
            3. SHOW active view
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent/40"
            onClick={() => {
              applyKanbanCommand(SANDBOX_THREAD_ID, FIXTURE_SHOW_NEXT_UP_VIEW);
              setActiveView(FIXTURE_SHOW_NEXT_UP_VIEW.view);
            }}
          >
            SHOW next-up view
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent/40"
            onClick={() => setActiveView(BOARD_VIEW)}
          >
            SHOW full board
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-rose-400/40"
            onClick={() => {
              resetKanbanBoard(SANDBOX_THREAD_ID);
              setActiveView(BOARD_VIEW);
            }}
          >
            Reset
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Board status: <span className="font-mono">{board?.status ?? "none"}</span> ·{" "}
          {board ? Object.keys(board.items).length : 0} items
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Rendered view</h2>
        <KanbanView threadId={SANDBOX_THREAD_ID} view={activeView} />
      </section>
    </main>
  );
}
