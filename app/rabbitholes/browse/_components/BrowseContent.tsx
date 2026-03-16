"use client";

import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

import { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@heroui/button";
import Link from "next/link";

import { RabbitHoleContext } from "@/lib/context/rabbithole-context";
import { deleteSession } from "@/data/supabase/rabbitholes";
import { removeSessionAudio } from "@/app/rabbitholes/_lib/audioStorage";
import Page from "@/components/layout/page";
import { SessionCard } from "@/components/rabbit-holes/SessionCard";

interface RabbitHolesBrowseContentProps {
  initialSessions: RabbitHoleSessionMetadata[];
}

export function RabbitHolesBrowseContent({ initialSessions }: RabbitHolesBrowseContentProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { sessions, setSessions, setSessionId, sessionId, clearSession } =
    useContext(RabbitHoleContext);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions, setSessions]);

  // Use context sessions once synced; otherwise show initialSessions to avoid flash of empty state
  const displaySessions = sessions.length > 0 ? sessions : initialSessions;

  const handleDelete = async (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (confirm("Are you sure you want to delete this rabbit hole?")) {
      setDeletingId(sessionIdToDelete);
      deleteSession(sessionIdToDelete);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionIdToDelete));
      setDeletingId(null);
      await removeSessionAudio(sessionIdToDelete);
      if (sessionId === sessionIdToDelete) {
        clearSession();
      }
    }
  };

  const handleSessionClick = (clickedSessionId: string) => {
    if (sessionId !== clickedSessionId) {
      setSessionId(clickedSessionId);
    }
    router.push(`/rabbitholes?sessionId=${encodeURIComponent(clickedSessionId)}`);
  };

  return (
    <Page className="block px-8 py-14">
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

      {displaySessions.length === 0 ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
          initial={{ opacity: 0, y: 20 }}
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
          {displaySessions.map((session: RabbitHoleSessionMetadata, index: number) => (
            <SessionCard
              key={session.sessionId}
              showDelete
              deletingId={deletingId}
              session={session}
              transitionDelay={index * 0.05}
              onClick={handleSessionClick}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
