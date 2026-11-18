"use client";

import { HelpCircle } from "lucide-react";

import { useOnboarding } from "./onboarding-context";

import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

/** The "?" in the control cluster. Opens the Guide on Start here. */
export function GuideTrigger({ className }: { className?: string }) {
  const { openGuide, guideOpen } = useOnboarding();

  return (
    <Button
      aria-expanded={guideOpen}
      aria-haspopup="dialog"
      aria-label="Open the Guide: first steps, surfaces, shortcuts and tips"
      className={cn("size-8 shrink-0", className)}
      data-guide-trigger
      size="icon"
      title="Guide"
      type="button"
      variant="ghost"
      onClick={() => openGuide("start")}
    >
      <HelpCircle className="size-4" />
    </Button>
  );
}
