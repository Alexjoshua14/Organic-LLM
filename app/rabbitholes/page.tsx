"use client";

import { Suspense, useContext } from "react";
import { RabbitHoleShell } from "./_components/RabbitHoleShell";
import { RabbitHoleContext } from "@/lib/context/rabbithole-context";

function RabbitHoleShellWrapper() {
  return <RabbitHoleShell />;
}

export default function RabbitHolesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <RabbitHoleShellWrapper />
    </Suspense>
  );
}

