"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/** Opens a fresh shell thread for one hard-set subagent and navigates into it. */
export function OpenShellButton({ agentId, agentName }: { agentId: string; agentName: string }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const res = await fetch("/api/subagents/shells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const data = (await res.json().catch(() => null)) as { threadId?: string } | null;

      if (!res.ok || !data?.threadId) throw new Error();
      router.push(`/sandbox/arcadia/${data.threadId}`);
    } catch {
      toast.error(`Could not open a shell for ${agentName}.`);
      setOpening(false);
    }
  };

  return (
    <button
      className={cn(
        "rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs font-medium",
        "transition-colors hover:bg-background-secondary disabled:opacity-60"
      )}
      disabled={opening}
      type="button"
      onClick={() => void open()}
    >
      {opening ? "Opening…" : "Open a new shell"}
    </button>
  );
}
