"use client";

import { createContext, useContext } from "react";

import type { ErgonChange, ErgonStateType, ErgonWorkItem } from "@/lib/schemas/gen-ui";

export type ErgonAction =
  | { type: "move"; item: ErgonWorkItem; to: ErgonStateType; toLabel: string }
  | { type: "complete"; item: ErgonWorkItem }
  | { type: "open"; item: ErgonWorkItem }
  | { type: "approve"; source: "todo" | "ticket"; changes: ErgonChange[] }
  | { type: "dismiss" };

export const ErgonActionsContext = createContext<(action: ErgonAction) => void>(() => {});

export const useErgonAction = () => useContext(ErgonActionsContext);

/**
 * Optional host helper: turn UI intent into a chat turn so Aion can call tools.
 * Do not use this for proposal writes — field values would be dropped. Bind
 * `ErgonProposalView`'s `apply` to an owner-scoped write path instead.
 */
export function chatActionHandler(send: (text: string) => void) {
  return (action: ErgonAction) => {
    switch (action.type) {
      case "move":
        return send(
          `Move ${action.item.source === "ticket" ? "ticket" : "task"} ${action.item.id} ("${action.item.title}") to ${action.toLabel}.`
        );
      case "complete":
        return send(
          `Mark ${action.item.source === "ticket" ? "ticket" : "task"} ${action.item.id} ("${action.item.title}") as done.`
        );
      case "open":
        if (action.item.href) window.open(action.item.href, "_blank", "noopener,noreferrer");
        return;
      case "approve":
        return send(
          `Approved. Apply these ${action.source} changes exactly as proposed:\n` +
            action.changes.map((c) => `- ${c.op} ${c.targetId ?? ""} ${c.title}`).join("\n")
        );
      case "dismiss":
        return send("Dismiss that proposal. Make no changes.");
    }
  };
}
