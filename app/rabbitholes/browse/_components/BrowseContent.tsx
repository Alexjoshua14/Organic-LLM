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
import { PageContentFrame } from "@/components/layout/page-content-frame";
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
    <Page className="items-stretch justify-start overflow-hidden">
      <div className="h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame maxWidth="5xl">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mb-2 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
                Rabbit Holes
              </h1>
              <p className="text-sm text-muted-foreground">
                Browse and manage your exploration sessions
              </p>
            </div>
            <Link className="shrink-0" href="/rabbitholes">
              <Button
                className="w-full bg-foreground text-background hover:opacity-80 sm:w-auto"
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
        </PageContentFrame>
      </div>
    </Page>
  );
}
