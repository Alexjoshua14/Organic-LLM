"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

import { showGatewayCache } from "./sandbox-gateway-button";

import { getShowSandboxGatewayForCurrentUser } from "@/data/supabase/profiles";

/**
 * Renders a Blog link when the signed-in user is admin (same visibility as
 * Sandbox/Showcase gateway). Uses shared showGatewayCache. Styled with
 * primary/secondary only, no accent.
 */
export function AdminBlogLink() {
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
      aria-label="Blog"
      className="rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground no-underline transition-colors hover:bg-secondary/80 hover:text-foreground"
      href="/blog"
    >
      Blog
    </Link>
  );
}
