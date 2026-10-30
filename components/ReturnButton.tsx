"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/third-party/ui/button";

export const ReturnButton = ({ compactOnMobile = false }: { compactOnMobile?: boolean }) => {
  const router = useRouter();

  const handleReturn = () => {
    router.back();
  };

  return (
    <Button
      className={
        compactOnMobile
          ? "size-11 p-0 text-sm font-medium sm:h-9 sm:w-auto sm:px-4"
          : "text-sm font-medium"
      }
      variant="ghost"
      onClick={handleReturn}
    >
      <ArrowLeft size={16} />
      <span className={compactOnMobile ? "sr-only sm:not-sr-only" : undefined}>Return</span>
    </Button>
  );
};
