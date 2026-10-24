"use client";

import { useAuth } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "organic-llm:knowledge-cache";

type StoredBlob = {
  userId: string;
  content: string;
  updatedAt: number;
};

function readStored(userId: string | null | undefined): string | null {
  if (!userId || typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBlob;

    if (parsed.userId === userId && typeof parsed.content === "string") {
      return parsed.content;
    }
  } catch {
    // ignore
  }

  return null;
}

function writeStored(userId: string, content: string) {
  const blob: StoredBlob = {
    userId,
    content,
    updatedAt: Date.now(),
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
}

function clearStored() {
  sessionStorage.removeItem(STORAGE_KEY);
}

type KnowledgeCacheContextValue = {
  cached: string | null;
  setCached: (text: string) => void;
  invalidate: () => void;
  invalidateIfSubstantial: (text: string) => void;
};

const KnowledgeCacheContext = createContext<KnowledgeCacheContextValue | null>(null);

export function KnowledgeCacheProvider({ children }: { children: ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const [cached, setCachedState] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      setCachedState(null);

      return;
    }

    setCachedState(readStored(userId));
  }, [userId, isLoaded]);

  const invalidate = useCallback(() => {
    clearStored();
    setCachedState(null);
  }, []);

  const setCached = useCallback(
    (text: string) => {
      if (!userId) return;
      writeStored(userId, text);
      setCachedState(text);
    },
    [userId]
  );

  const invalidateIfSubstantial = useCallback(
    (text: string) => {
      const trimmed = text.trim();

      if (!trimmed || !userId) return;

      void (async () => {
        try {
          const res = await fetch("/api/profile/knowledge/classify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ text: trimmed }),
          });

          if (!res.ok) return;
          const data = (await res.json()) as { substantial?: boolean };

          if (data.substantial) {
            invalidate();
          }
        } catch {
          // ignore
        }
      })();
    },
    [userId, invalidate]
  );

  const value = useMemo(
    () => ({
      cached,
      setCached,
      invalidate,
      invalidateIfSubstantial,
    }),
    [cached, setCached, invalidate, invalidateIfSubstantial]
  );

  return <KnowledgeCacheContext.Provider value={value}>{children}</KnowledgeCacheContext.Provider>;
}

export function useKnowledgeCache(): KnowledgeCacheContextValue {
  const ctx = useContext(KnowledgeCacheContext);

  if (!ctx) {
    throw new Error("useKnowledgeCache must be used within KnowledgeCacheProvider");
  }

  return ctx;
}
