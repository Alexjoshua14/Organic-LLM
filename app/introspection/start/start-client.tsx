"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/third-party/ui/button";

type BootstrapState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string };

export default function IntrospectionStartClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const payload = searchParams.get("p") ?? "";
  const startedRef = useRef(false);
  const [state, setState] = useState<BootstrapState>({ phase: "idle" });

  useEffect(() => {
    if (!payload) {
      setState({ phase: "error", message: "Missing introspection payload (?p=)." });
    }
  }, [payload]);

  useEffect(() => {
    if (!payload || startedRef.current) return;

    startedRef.current = true;
    setState({ phase: "loading" });

    void (async () => {
      try {
        const res = await fetch("/api/introspection/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const data = (await res.json()) as { path?: string; error?: string };

        if (!res.ok) {
          setState({
            phase: "error",
            message: data.error ?? "Failed to start introspection session",
          });

          return;
        }

        if (data.path) {
          router.replace(`${data.path}?entry=morph`);
        }
      } catch {
        setState({ phase: "error", message: "Network error while starting session" });
      }
    })();
  }, [payload, router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <SignedOut>
        <p className="text-muted-foreground max-w-md text-sm">
          Sign in to continue your Introspection guided session in Organic LLM.
        </p>
        <SignInButton mode="modal">
          <Button>Sign in</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        {state.phase === "loading" || state.phase === "idle" ? (
          <>
            <Loader2 className="text-muted-foreground size-8 animate-spin" />
            <p className="text-muted-foreground text-sm">Preparing your guided session…</p>
          </>
        ) : null}
        {state.phase === "error" ? (
          <p className="text-destructive max-w-md text-sm">{state.message}</p>
        ) : null}
      </SignedIn>
    </div>
  );
}
