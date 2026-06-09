"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

import { useWelcomeMotion } from "./welcome-motion";

import { glass } from "@/components/design-system/primitives";
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
      className={cn("w-full md:max-w-md md:justify-self-end md:self-center", className)}
      variants={staggerItem}
    >
      <div
        className={cn(
          "min-h-[12rem] rounded-2xl border border-border/50 p-6 sm:min-h-[14rem] sm:p-8",
          glass({ border: "none", opaque: true })
        )}
      >
        <p
          className="mb-5 font-commissioner text-base font-light text-foreground sm:mb-6 sm:text-lg"
          id="welcome-explore-label"
        >
          {welcomeCopy.explore.label}
        </p>
        <ul className="flex flex-col gap-2">
          {welcomeCopy.explore.links.map((link) => (
            <li key={link.href}>
              <Link
                className="group -mx-2 flex items-start justify-between gap-3 rounded-xl px-2 py-4 transition-colors hover:bg-muted/40 sm:py-5"
                data-dim-background
                href={link.href}
              >
                <span className="min-w-0 text-left">
                  <span className="block text-sm font-medium text-foreground sm:text-[15px]">
                    {link.label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {link.description}
                  </span>
                </span>
                <ArrowUpRight
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground/60 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                  strokeWidth={1.5}
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </motion.aside>
  );
}
