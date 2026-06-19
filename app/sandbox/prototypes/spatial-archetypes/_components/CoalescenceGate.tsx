"use client";

import Link from "next/link";

import { Button } from "@/components/third-party/ui/button";

export function CoalescenceGate() {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border/60 bg-background-tertiary/20 p-8 text-center">
      <h2 className="text-lg font-semibold text-foreground">Coalescence Mode required</h2>
      <p className="text-sm text-muted-foreground">
        Enable <strong>Coalescence Mode</strong> in Settings to index gen-ui blocks from your threads
        and browse them in the spatial artifact library.
      </p>
      <Button asChild variant="default">
        <Link href="/settings">Open Settings</Link>
      </Button>
    </div>
  );
}
