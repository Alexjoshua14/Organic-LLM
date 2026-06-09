"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { WelcomeHighlightVisual } from "./welcome-highlight-visual";

import { useLandingMotion } from "@/components/pages/use-landing-motion";
import type { WelcomeHighlightItem } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

type WelcomeHighlightRowProps = {
  item: WelcomeHighlightItem & { imageSrc?: string };
};

export function WelcomeHighlightRow({ item }: WelcomeHighlightRowProps) {
  const { sectionReveal } = useLandingMotion();
  const reversed = item.reverse === true;

  return (
    <motion.article
      className={cn(
        "flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:gap-12 lg:gap-16",
        reversed && "sm:flex-row-reverse"
      )}
      {...(sectionReveal ?? {})}
    >
      <div className="min-w-0 flex-1 text-left">
        <h3 className="font-commissioner text-2xl font-light tracking-tight text-foreground sm:text-[1.65rem]">
          {item.title}
        </h3>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px] sm:leading-[1.65]">
          {item.body}
        </p>
        {"link" in item && item.link ? (
          <p className="mt-4">
            <Link
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              href={item.link.href}
            >
              {item.link.label}
            </Link>
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          "w-full shrink-0 sm:flex sm:w-auto sm:flex-1",
          reversed ? "sm:justify-start" : "sm:justify-end"
        )}
      >
        <WelcomeHighlightVisual
          aspect="highlight"
          id={item.id}
          imageAlt={item.visualPlaceholder.hint}
          imageSrc={item.imageSrc}
          placeholder={item.visualPlaceholder}
          size="highlight"
        />
      </div>
    </motion.article>
  );
}
