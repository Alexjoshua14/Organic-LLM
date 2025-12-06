import { Suspense } from "react";
import { RabbitHoleShell } from "./_components/RabbitHoleShell";

export default function RabbitHolesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <RabbitHoleShell />
    </Suspense>
  );
}

