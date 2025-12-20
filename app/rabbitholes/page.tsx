"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RabbitHoleShell } from "./_components/RabbitHoleShell";

function RabbitHoleShellWrapper() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || undefined;

  return <RabbitHoleShell sessionId={sessionId} />;
}

export default function RabbitHolesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <RabbitHoleShellWrapper />
    </Suspense>
  );
}

