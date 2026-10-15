"use client";

import { SignUpButton } from "@clerk/nextjs";
import { useRef } from "react";

import { useHydrated } from "./use-hydrated";
import { useWelcomeInView } from "./use-welcome-in-view";
import { WelcomeFeatures } from "./welcome-features";
import { WelcomeHeadline } from "./welcome-headline";
import { WelcomeHighlights } from "./welcome-highlights";
import { WelcomePageFooter } from "./welcome-page-footer";
import { WelcomeScrollInvite } from "./welcome-scroll-invite";
import { WelcomeSpecimen } from "./welcome-specimen";
import styles from "./welcome-specimen.module.css";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";
import { PublicSiteHeader } from "@/components/layout/public-site-header";
import { welcomeCopy } from "@/lib/welcome/copy";

export function WelcomeHero() {
  const detailsRef = useRef<HTMLDivElement>(null);
  // The hero server-renders for signed-out visitors. Below-fold sections wait for hydration:
  // their reveal motion depends on reduced-motion, which the server cannot know.
  const hydrated = useHydrated();
  const detailsVisible = useWelcomeInView(detailsRef, {
    threshold: 0,
    rootMargin: "0px 0px -1px 0px",
  });

  return (
    <Page
      chrome="full-bleed"
      className="!items-stretch !justify-start !gap-0 overflow-y-auto overflow-x-hidden"
      liquidChromeBackground
      transparentBackground
    >
      <div className={styles.welcomePage} data-welcome-page>
        <div className="relative z-10 flex w-full flex-col">
          <section className={styles.hero} aria-label="Welcome to Organic LLM">
            <WelcomeSpecimen />

            <PublicSiteHeader className={styles.header} showThemeToggle />

            <div className={styles.content}>
              <div className={styles.copy}>
                <WelcomeHeadline className={styles.headline} />
                <div className={styles.heroActions}>
                  <p className={styles.subline}>{welcomeCopy.subline}</p>
                  <SignUpButton mode="modal">
                    <button className={styles.accountAction} type="button">
                      {welcomeCopy.cta.signUp}
                    </button>
                  </SignUpButton>
                </div>
              </div>
            </div>

            <WelcomeScrollInvite className={styles.scrollInvite} />
          </section>

          <div ref={detailsRef} className={styles.details} data-welcome-details>
            {hydrated ? (
              <>
                <div className={styles.detailsAtmosphere} aria-hidden>
                  <div className={styles.chromeViewport}>
                    {detailsVisible ? (
                      <AdaptiveLiquidChrome cover="parent" dimIntensity={0.45} />
                    ) : null}
                  </div>
                </div>
                <div className={styles.detailsContent}>
                  <WelcomeFeatures />
                  <WelcomeHighlights />
                  <WelcomePageFooter />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Page>
  );
}
