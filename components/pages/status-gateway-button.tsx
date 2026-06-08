"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

import { showGatewayCache } from "./sandbox-gateway-button";

import { getShowSandboxGatewayForCurrentUser } from "@/data/supabase/profiles";
import { cn } from "@/lib/utils";

/**
 * Admin-only link to /status. Shares sandbox gateway visibility cache.
 */
export function StatusGatewayButton({ className }: { className?: string }) {
  const { userId } = useAuth();
  const [show, setShow] = useState<boolean | null>(() =>
    userId ? (showGatewayCache.get(userId) ?? null) : null
  );

  useEffect(() => {
    if (!userId) return;
    const cached = showGatewayCache.get(userId);
    if (cached !== undefined) {
      setShow(cached);
      return;
    }
    setShow(null);
    getShowSandboxGatewayForCurrentUser().then((value) => {
      showGatewayCache.set(userId, value);
      setShow(value);
    });
  }, [userId]);

  if (!userId || show === false) return null;

  return (
    <Link
      aria-label="System status"
      className={cn(
        "rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground no-underline transition-colors hover:bg-secondary/80",
        className
      )}
      href="/status"
    >
      Status
    </Link>
  );
}
