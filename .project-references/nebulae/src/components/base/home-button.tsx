"use client";

import Link from "next/link";
import { Button } from "./button";

export function HomeButton() {
  return (
    <Button
      asChild
      variant="secondary"
      size="default"
      className="fixed top-2 left-2 z-50 cursor-pointer text-secondary-foreground hover:bg-secondary! hover:text-primary! transition-all duration-300"
      aria-label="Home"
    >
      <Link href="/">Nebulae</Link>
    </Button>
  );
}

