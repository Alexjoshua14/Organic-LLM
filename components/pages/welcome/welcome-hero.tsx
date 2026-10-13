"use client";

import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { useRef } from "react";

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
import { welcomeCopy } from "@/lib/welcome/copy";

export function WelcomeHero() {
  const detailsRef = useRef<HTMLDivElement>(null);
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

            <header className={styles.header}>
              <Link className={styles.brand} href="/" aria-label="Organic LLM home">
                {welcomeCopy.headline}
              </Link>
              <nav className={styles.navigation} aria-label="Homepage navigation">
                <Link className={styles.navLink} href="/showcase">
                  Showcase
                </Link>
                <SignInButton mode="modal">
                  <button className={styles.navLink} type="button">
                    {welcomeCopy.cta.signIn}
                  </button>
                </SignInButton>
              </nav>
            </header>

            <div className={styles.content}>
              <div className={styles.copy}>
                <WelcomeHeadline className={styles.headline} />
                <p className={styles.subline}>{welcomeCopy.subline}</p>
              </div>
              <SignUpButton mode="modal">
                <button className={styles.primaryAction} type="button">
                  {welcomeCopy.cta.signUp}
                  <ArrowRight aria-hidden size={20} strokeWidth={1.25} />
                </button>
              </SignUpButton>
            </div>

            <WelcomeScrollInvite className={styles.scrollInvite} />
          </section>

          <div ref={detailsRef} className={styles.details} data-welcome-details>
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
          </div>
        </div>
      </div>
    </Page>
  );
}
