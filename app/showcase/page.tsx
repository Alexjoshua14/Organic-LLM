import type { Metadata } from "next";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { FieldTrip } from "@/components/showcase/FieldTrip";
import { FIELD_TRIP_INTRO } from "@/lib/showcase/field-trip";

export const metadata: Metadata = {
  title: "Showcase | Organic LLM",
  description:
    "An independent AI app and design lab. Explore connected research, generative interfaces, voice, memory, and model controls through interactive demos.",
};

/** Public, local-data field trip. Each chapter mounts its demo as it nears view; no model calls. */
export default function ShowcasePage() {
  return (
    <div className="showcase-scroll">
      <div className="showcase-container">
        <header className="showcase-intro">
          <h1>Follow an idea further.</h1>
          <p className="showcase-intro-copy">{FIELD_TRIP_INTRO}</p>
          <p className="showcase-intro-note">
            Scripted demos on fictional data. Nothing here calls a model.
          </p>
        </header>
        <FieldTrip />
        <footer className="showcase-footer" id="engineering">
          <h2>Under the hood</h2>
          <nav aria-label="Go deeper">
            <Link href="/showcase/anatomy">Follow one response</Link>
            <Link href="/showcase/ergon">Watch a board take shape</Link>
            <Link href="/showcase/memory">Look inside memory</Link>
            <Link href="/dev/docs">Engineering notes</Link>
            <a href="https://github.com/Alexjoshua14/Organic-LLM" rel="noreferrer" target="_blank">
              Source <ArrowUpRight aria-hidden size={14} />
            </a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
