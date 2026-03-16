"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import Page from "@/components/layout/page";
import { SandboxShell } from "@/components/sandbox/SandboxShell";

export default function SandboxPlatformPage() {
  return (
    <Page className="!items-stretch !justify-stretch h-full">
      <div className="flex flex-col w-full h-full max-w-full overflow-hidden">
        <div className="shrink-0 px-4 pt-4">
          <Link
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            href="/sandbox"
          >
            <ArrowLeft className="size-4" />
            Sandbox
          </Link>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <SandboxShell />
        </div>
      </div>
    </Page>
  );
}
