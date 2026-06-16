"use client";

import { motion } from "framer-motion";

import { WelcomeExploreAside } from "./welcome-explore-aside";
import { WelcomeFeatures } from "./welcome-features";
import { WelcomeHeadline } from "./welcome-headline";
import { WelcomeHighlights } from "./welcome-highlights";
import { WelcomePageFooter } from "./welcome-page-footer";
import { WelcomeScrollInvite } from "./welcome-scroll-invite";
import { useWelcomeMotion } from "./welcome-motion";

import { OrganicPresence } from "@/components/ambient/OrganicPresence";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";
import { SignedOutAuthButtons } from "@/components/pages/signed-out-auth-buttons";
import { welcomeCopy } from "@/lib/welcome/copy";
import { cn } from "@/lib/utils";

export function WelcomeHero() {
  const { staggerContainer, staggerItem, blurReveal, reduce } = useWelcomeMotion();

  return (
    <Page
      chrome="full-bleed"
      className="!items-stretch !justify-start overflow-y-auto overflow-x-hidden"
      transparentBackground
    >
      <div className="relative flex w-full flex-col">
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
          <AdaptiveLiquidChrome cover="viewport" dimIntensity={0.45} />
        </div>

        {!reduce ? (
          <>
            <OrganicPresence
              className="hidden lg:block"
              color="oklch(0.72 0.12 160)"
              intensity={0.1}
              position="top-right"
              size={72}
            />
            <OrganicPresence
              className="hidden lg:block"
              color="oklch(0.72 0.12 160)"
              intensity={0.08}
              position="bottom-left"
              size={56}
            />
          </>
        ) : null}

        <div className="relative z-10 flex w-full flex-col">
          <section className="relative flex min-h-dvh flex-col px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-20 lg:px-12 lg:pb-24 lg:pt-24">
            <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-8">
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute left-[18%] top-[22%] -z-10 h-[28rem] w-[28rem] rounded-full blur-3xl lg:left-[12%]",
                  !reduce && "motion-safe:animate-[welcome-bloom-breathe_6s_ease-in-out_infinite]"
                )}
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklch, var(--accent) 8%, transparent) 0%, transparent 68%)",
                }}
              />

              <motion.div
                animate="show"
                className="grid grid-cols-1 items-start gap-12 sm:grid-cols-[minmax(0,1fr)_min(18rem,34%)] sm:gap-x-12 md:gap-x-16 lg:gap-x-20 lg:gap-y-12"
                initial="hidden"
                variants={staggerContainer}
              >
                <div className="flex min-w-0 flex-col items-start text-left sm:col-start-1 sm:row-start-1">
                  <motion.p
                    className="font-commissioner text-sm font-light tracking-tight text-muted-foreground"
                    variants={staggerItem}
                  >
                    {welcomeCopy.kicker}
                  </motion.p>

                  <WelcomeHeadline />

                  <motion.p
                    className="mt-8 max-w-lg text-pretty text-base leading-[1.65] text-muted-foreground sm:mt-10 md:text-[1.0625rem] md:leading-[1.7]"
                    variants={blurReveal}
                  >
                    {welcomeCopy.sublineSegments.map((segment, index) =>
                      segment.type === "emphasis" ? (
                        <strong key={index} className="font-medium text-foreground/95">
                          {segment.value}
                        </strong>
                      ) : (
                        <span key={index}>{segment.value}</span>
                      )
                    )}
                  </motion.p>

                  <motion.div
                    className="mt-10 sm:mt-12"
                    data-dim-background="full"
                    variants={staggerItem}
                  >
                    <SignedOutAuthButtons align="start" />
                  </motion.div>
                </div>

                <WelcomeExploreAside />
              </motion.div>
            </div>

            <div className="flex shrink-0 justify-center pb-2 sm:pb-4">
              <WelcomeScrollInvite />
            </div>
          </section>

          <WelcomeFeatures />
          <WelcomeHighlights />
          <WelcomePageFooter />
        </div>
      </div>
    </Page>
  );
}
