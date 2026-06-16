"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import { useWelcomeMotion } from "./welcome-motion";

import { glass } from "@/components/design-system/primitives";
import { sectionLabel, card } from "@/lib/rabbit-holes/designTokens";
import { welcomeCopy } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

type WelcomeExploreAsideProps = {
  className?: string;
};

export function WelcomeExploreAside({ className }: WelcomeExploreAsideProps) {
  const { staggerItem } = useWelcomeMotion();

  return (
    <motion.aside
      aria-labelledby="welcome-explore-label"
      className={cn(
        "w-full sm:col-start-2 sm:row-start-1 sm:max-w-md sm:justify-self-end sm:self-center",
        className
      )}
      variants={staggerItem}
    >
      <div
        className={cn(
          "rounded-2xl border border-border/50 p-4 sm:p-5",
          glass({ border: "none", opaque: true })
        )}
      >
        <div className="mb-2 flex flex-col items-center gap-0.5 text-center">
          <p className={sectionLabel} id="welcome-explore-label">
            {welcomeCopy.explore.label}
          </p>
          <span className="text-[10px] text-muted-foreground/75">
            {welcomeCopy.explore.subtitle}
          </span>
        </div>

        <div className={cn(card, "rounded-lg p-1 sm:p-1.5")}>
          <ul className="flex flex-col">
            {welcomeCopy.explore.links.map((link) => (
              <li key={link.href}>
                <Link
                  className="group flex items-start justify-between gap-2 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/35 sm:px-2.5 sm:py-3"
                  data-dim-background
                  href={link.href}
                >
                  <span className="min-w-0 text-left">
                    <span className="block text-xs font-medium text-foreground/90">
                      {link.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground/75">
                      {link.description}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/55 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-foreground/80"
                    strokeWidth={1.5}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.aside>
  );
}
