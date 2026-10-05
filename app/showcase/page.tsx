import type { Metadata } from "next";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Code2 } from "lucide-react";

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
          <p className="showcase-kicker">An independent AI app &amp; design lab</p>
          <h1>Follow an idea further.</h1>
          <p className="showcase-intro-copy">
            An AI workspace for connected research, useful answers, and conversations that remember
            where you left off.
          </p>
          <p className="showcase-intro-trip">{FIELD_TRIP_INTRO}</p>
        </header>
        <FieldTrip />
        <section
          aria-labelledby="engineering-title"
          className="showcase-engineering"
          id="engineering"
        >
          <div className="showcase-engineering-intro">
            <Code2 aria-hidden size={26} strokeWidth={1.5} />
            <h2 id="engineering-title">
              The details are
              <br />
              part of the product.
            </h2>
            <p>
              Organic LLM is a full-stack application and a place to explore how AI interfaces can
              feel. The code is open to explore, too.
            </p>
            <a
              className="showcase-text-link"
              href="https://github.com/Alexjoshua14/Organic-LLM"
              rel="noreferrer"
              target="_blank"
            >
              Explore the source <ArrowUpRight aria-hidden size={16} />
            </a>
          </div>
          <div className="showcase-engineering-links">
            <Link href="/showcase/anatomy">
              <span>
                <strong>Follow one response</strong>
                <span>Context, memory, tools, and streaming, traced through the interface.</span>
              </span>
              <ArrowRight aria-hidden size={20} />
            </Link>
            <Link href="/showcase/ergon">
              <span>
                <strong>Watch a board take shape</strong>
                <span>A conversation creates and rearranges a working kanban board.</span>
              </span>
              <ArrowRight aria-hidden size={20} />
            </Link>
            <Link href="/showcase/memory">
              <span>
                <strong>Look inside memory</strong>
                <span>See how stored context surfaces across conversations.</span>
              </span>
              <ArrowRight aria-hidden size={20} />
            </Link>
            <Link href="/dev/docs">
              <span>
                <strong>Read the engineering notes</strong>
                <span>Architecture, context assembly, and the systems behind the experience.</span>
              </span>
              <ArrowRight aria-hidden size={20} />
            </Link>
          </div>
        </section>
        <footer className="showcase-footer">
          <p>Built with curiosity. Open for exploration.</p>
          <span>Interactive previews use fictional data and make no live AI calls.</span>
        </footer>
      </div>
    </div>
  );
}
