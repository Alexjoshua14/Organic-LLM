"use client";

import { Suspense, useContext } from "react";
import { RabbitHoleShell } from "components/rabbit-holes/RabbitHoleShell";
import { RabbitHoleContext } from "@/lib/context/rabbithole-context";

export default function RabbitHolesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <RabbitHoleShell />
    </Suspense>
  );
}

