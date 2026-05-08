import Link from "next/link";
import { Button, ThemeToggle } from "@/components/base";

export default function Home() {
  return (
    <>
      <ThemeToggle />
      <main className="min-h-screen flex items-center justify-center relative bg-linear-to-br from-neutral-50 via-neutral-100 to-neutral-300 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-700">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,oklch(0.92_0.004_286/0.15)_100%)] dark:bg-[radial-gradient(circle_at_50%_50%,transparent_0%,oklch(0.21_0.006_286/0.2)_100%)] pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto px-6 sm:px-8 py-12 sm:py-16 text-center">
          <div className="flex flex-col items-center gap-12">
            <div className="flex flex-col items-center gap-6">
              <h1 className="text-5xl sm:text-6xl font-light tracking-tight text-neutral-900 dark:text-neutral-50">
                Project Nebulae
              </h1>
              <p className="text-xl text-neutral-600 dark:text-neutral-400 font-light">
                Component Lab
              </p>
            </div>

            <div className="max-w-lg">
              <p className="text-base sm:text-lg text-neutral-700 dark:text-neutral-300 leading-relaxed">
                A sandbox for prototyping components, flows, and agent behaviors.
                Product-agnostic. Domain-agnostic. Long-lived and curated.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild variant="primary">
                <Link href="/experiments">View Experiments</Link>
              </Button>

              <Button asChild variant="secondary">
                <Link href="/docs">
                  Documentation
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
