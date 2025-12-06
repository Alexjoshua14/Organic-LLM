"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trash2, ArrowRight, Plus } from "lucide-react";
import { Button } from "@heroui/button";
import Link from "next/link";
import {
  getAllSessions,
  deleteSession,
  type RabbitHoleSessionMetadata,
} from "../_lib/sessionStorage";
import { formatDate } from "../_lib/dateUtils";
import { cn } from "@/lib/utils";

export default function RabbitHolesBrowsePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<RabbitHoleSessionMetadata[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setSessions(getAllSessions());
  }, []);

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (confirm("Are you sure you want to delete this rabbit hole?")) {
      setDeletingId(sessionId);
      deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setDeletingId(null);
    }
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/rabbitholes?session=${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-commissioner text-4xl font-light tracking-tight text-[#2D2B26] dark:text-[#F3F4F3] mb-2">
              Rabbit Holes
            </h1>
            <p className="font-satoshi text-[#5C5E5E] dark:text-[#A0A2A2] text-sm">
              Browse and manage your exploration sessions
            </p>
          </div>
          <Link href="/rabbitholes">
            <Button
              className="bg-[#2D2B26] dark:bg-[#F3F4F3] text-[#F3F4F3] dark:text-[#2D2B26] hover:opacity-80"
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
            <p className="font-commissioner text-xl text-[#5C5E5E] dark:text-[#A0A2A2] mb-4 font-light">
              No rabbit holes yet
            </p>
            <p className="font-satoshi text-sm text-[#5C5E5E]/70 dark:text-[#A0A2A2]/70 mb-8">
              Start exploring a topic to create your first rabbit hole
            </p>
            <Link href="/rabbitholes">
              <Button
                className="bg-[#2D2B26] dark:bg-[#F3F4F3] text-[#F3F4F3] dark:text-[#2D2B26] hover:opacity-80"
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
                  "bg-white/80 dark:bg-[#1C1E1F]/80 backdrop-blur-sm rounded-lg border border-[#DCDDDC] dark:border-[#2A2C2D] shadow-sm",
                  "hover:shadow-md transition-all cursor-pointer group",
                )}
                onClick={() => handleSessionClick(session.sessionId)}
              >
                <div className="p-6 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-commissioner text-lg font-light text-[#2D2B26] dark:text-[#F3F4F3] mb-2 line-clamp-2">
                      {session.rootQuestion}
                    </h3>
                    {session.summary && (
                      <p className="font-satoshi text-sm text-[#5C5E5E] dark:text-[#A0A2A2] mb-3 line-clamp-2">
                        {session.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-[#5C5E5E] dark:text-[#A0A2A2]">
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
                      className="p-2 rounded-md text-[#5C5E5E] dark:text-[#A0A2A2] hover:text-red-600 dark:hover:text-red-400 hover:bg-white/30 dark:hover:bg-[#1C1E1F]/30 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDelete(session.sessionId, e)}
                      disabled={deletingId === session.sessionId}
                    >
                      <Trash2 size={16} />
                    </button>
                    <ArrowRight
                      size={16}
                      className="text-[#5C5E5E] dark:text-[#A0A2A2] opacity-0 group-hover:opacity-100 transition-opacity"
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

