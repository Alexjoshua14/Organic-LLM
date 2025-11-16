"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/third-party/ui/button";
import { ArrowLeft } from "lucide-react";

export const ReturnButton = () => {
  const router = useRouter();

  const handleReturn = () => {
    router.back();
  };

  return (
    <Button
      className="text-sm font-medium"
      variant="ghost"
      onClick={handleReturn}
    >
      <ArrowLeft size={16} />
      Return
    </Button>
  );
};
