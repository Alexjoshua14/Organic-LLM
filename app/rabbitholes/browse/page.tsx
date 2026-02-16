"use client";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trash2, ArrowRight, Plus } from "lucide-react";
import { Button } from "@heroui/button";
import Link from "next/link";
import { RabbitHoleContext } from "@/lib/context/rabbithole-context";
import {
  getAllSessions,
  deleteSession
} from '@/data/supabase/rabbitholes'

import { formatDate } from "@/lib/format/stringFormatting";
import { cn } from "@/lib/utils";
import { removeSessionAudio } from "../_lib/audioStorage";

export default function RabbitHolesBrowsePage() {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { sessions, setSessions, setSessionId, sessionId, clearSession } = useContext(RabbitHoleContext);

  useEffect(() => {
    const fetchSessions = async () => {
      const res = await getAllSessions()

      if (res.data) {
        setSessions(res.data)
      } else {
        console.log(res.error ?? "No data retrieved from getAllSessions call")
      }
    }

    fetchSessions()
  }, []);

  const handleDelete = async (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (confirm("Are you sure you want to delete this rabbit hole?")) {
      setDeletingId(sessionIdToDelete);
      deleteSession(sessionIdToDelete);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionIdToDelete));
      setDeletingId(null);
      // Handle cleaning up any now orphaned audio
      await removeSessionAudio(sessionIdToDelete);
      // If current session is opened, close it
      if (sessionId === sessionIdToDelete) {
        clearSession();
      }
    }
  };

  const handleSessionClick = (clickedSessionId: string) => {
    if (sessionId !== clickedSessionId) {
      setSessionId(clickedSessionId);
    }
    // Pass sessionId in URL so the explorer loads it on mount (avoids race with context update)
    router.push(`/rabbitholes?sessionId=${encodeURIComponent(clickedSessionId)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-commissioner text-4xl font-light tracking-tight text-foreground mb-2">
              Rabbit Holes
            </h1>
            <p className="text-muted-foreground text-sm">
              Browse and manage your exploration sessions
            </p>
          </div>
          <Link href="/rabbitholes">
            <Button
              className="bg-foreground text-background hover:opacity-80"
              startContent={<Plus size={16} />}
            >
              New Rabbit Hole
            </Button>
          </Link>
        </div>

        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <p className="font-commissioner text-xl text-muted-foreground mb-4 font-light">
              No rabbit holes yet
            </p>
            <p className="text-sm text-muted-foreground/70 mb-8">
              Start exploring a topic to create your first rabbit hole
            </p>
            <Link href="/rabbitholes">
              <Button
                className="bg-foreground text-background hover:opacity-80"
                startContent={<Plus size={16} />}
              >
                Create Your First Rabbit Hole
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session, index) => (
              <motion.div
                key={session.sessionId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "bg-card/80 backdrop-blur-sm rounded-lg border border-border shadow-sm",
                  "hover:shadow-md transition-all cursor-pointer group",
                )}
                onClick={() => handleSessionClick(session.sessionId)}
              >
                <div className="p-6 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-commissioner text-lg font-light text-foreground mb-2 line-clamp-2">
                      {session.rootQuestion}
                    </h3>
                    {session.summary && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {session.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {formatDate(session.updatedAt)}
                      </span>
                      <span>•</span>
                      <span>{session.pathLength} level{session.pathLength !== 1 ? "s" : ""} explored</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-card/30 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDelete(session.sessionId, e)}
                      disabled={deletingId === session.sessionId}
                    >
                      <Trash2 size={16} />
                    </button>
                    <ArrowRight
                      size={16}
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

