"use client";

import Link from "next/link";
import { Button } from "@/components/base";

interface Experiment {
  id: string;
  name: string;
  description: string;
  path: string;
}

const experiments: Experiment[] = [
  {
    id: "glass-surface",
    name: "Glass Surface",
    description:
      "Foundational experiment exploring liquid glass aesthetic with subtle depth and gentle micro-interactions",
    path: "/experiments/glass-surface",
  },
  {
    id: "streaming-text-animations",
    name: "Streaming Text Animations",
    description:
      "Prototyping lab for exploring different text streaming animation patterns with configurable granularity, timing, and visual effects",
    path: "/experiments/streaming-text-animations",
  },
  {
    id: "morph-lab",
    name: "Morph Lab",
    description:
      "Sandbox for exploring fluid morphing UI surfaces, transitions, and organic motion patterns",
    path: "/experiments/morph-lab",
  },
];

export default function ExperimentsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-8 md:p-10 lg:p-12 pt-14 sm:pt-16 bg-linear-to-br from-neutral-100 via-neutral-50 to-neutral-200 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-800">
      <div className="w-full max-w-4xl flex flex-col gap-12">
        {/* Header */}
        <div className="text-center flex flex-col gap-3">
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-neutral-900 dark:text-neutral-50">
            Experiments
          </h1>
          <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400">
            Explore interactive prototypes and component explorations
          </p>
        </div>

        {/* Experiments Grid */}
        <div className="flex flex-col gap-6">
          {experiments.map((experiment) => (
            <Link
              key={experiment.id}
              href={experiment.path}
              className="glass-surface p-6 sm:p-8 transition-all hover:scale-[1.02] hover:-translate-y-1"
            >
              <div className="flex flex-col gap-3">
                <h2 className="text-2xl sm:text-3xl font-light text-neutral-900 dark:text-neutral-50">
                  {experiment.name}
                </h2>
                <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {experiment.description}
                </p>
                <div className="pt-2">
                  <span className="text-sm text-neutral-500 dark:text-neutral-500 inline-flex items-center gap-1.5">
                    View experiment
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Back link */}
        <div className="text-center">
          <Button asChild variant="secondary">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

