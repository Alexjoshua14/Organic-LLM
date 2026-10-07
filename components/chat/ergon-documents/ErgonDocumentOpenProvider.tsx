"use client";

import type { ErgonDocumentSummary } from "@/lib/schemas/ergon-documents";
import type { UIMessage } from "ai";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  buildOpenDocumentMessage,
  newOpenDocumentIds,
} from "@/lib/ergon-documents/open-message";

type ErgonDocumentOpenContextValue = {
  openDocument: (document: ErgonDocumentSummary) => void;
};

const ErgonDocumentOpenContext = createContext<ErgonDocumentOpenContextValue | null>(null);

export function useErgonDocumentOpen(): ErgonDocumentOpenContextValue | null {
  return useContext(ErgonDocumentOpenContext);
}

type ErgonDocumentOpenProviderProps = {
  chatId?: string;
  status: string;
  setMessages: React.Dispatch<React.SetStateAction<UIMessage[]>>;
  children: ReactNode;
};

export function ErgonDocumentOpenProvider({
  chatId,
  status,
  setMessages,
  children,
}: ErgonDocumentOpenProviderProps) {
  const openDocument = useCallback(
    (document: ErgonDocumentSummary) => {
      if (!chatId) {
        toast.error("Thread is not ready yet.");

        return;
      }

      if (status !== "ready") {
        toast.error("Wait for the current response to finish.");

        return;
      }

      const { messageId, toolCallId } = newOpenDocumentIds();
      const message = buildOpenDocumentMessage({ messageId, toolCallId, document });

      setMessages((prev) => [...prev, message]);

      void fetch(`/api/ergon/documents/${document.id}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, messageId, toolCallId }),
      }).then(async (res) => {
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;

          toast.error(payload?.error ?? "Failed to save document view to thread.");
        }
      });
    },
    [chatId, setMessages, status]
  );

  const value = useMemo(() => ({ openDocument }), [openDocument]);

  return (
    <ErgonDocumentOpenContext.Provider value={value}>{children}</ErgonDocumentOpenContext.Provider>
  );
}
