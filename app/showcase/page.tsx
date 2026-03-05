import Link from "next/link";

import Page from "@/components/layout/page";

/**
 * Public showcase gateway. Pages here are snapshots promoted from sandbox —
 * layout/content is fixed until you rebase from sandbox; shared components
 * (e.g. MemoryLensCard) update automatically.
 */
export default function ShowcasePage() {
  const showcasePages = [
    {
      title: "Memory",
      description:
        "Persisted memory lens, cards, and ephemeral in-chat components — what Organic LLM stores and how it surfaces across threads.",
      href: "/showcase/memory",
      icon: "🧠",
      size: "small" as const,
      gradient: "from-cyan-400/20 to-emerald-500/20",
      hoverGradient: "hover:from-cyan-400/30 hover:to-emerald-500/30",
    },
  ];

  return (
    <Page>
      <div className="w-full max-w-6xl mx-auto p-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-linear-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            Showcase
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Public demos and previews I’m comfortable sharing. Each page is a
            snapshot; components inside stay up to date.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
          {showcasePages.map((page) => (
            <Link
              key={page.href}
              className={`
                group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800
                bg-linear-to-br ${page.gradient} ${page.hoverGradient}
                transition-all duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-xl
                ${page.size === "large" ? "md:col-span-1 lg:row-span-2" : "md:col-span-1"}
                p-6 flex flex-col justify-between min-h-[200px]
              `}
              href={page.href}
            >
              <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                <div className="absolute inset-0 bg-linear-to-br from-transparent via-white to-transparent transform rotate-12 scale-150" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{page.icon}</span>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                    {page.title}
                  </h2>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-6">
                  {page.description}
                </p>
              </div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
                  View
                </div>
                <div className="transform group-hover:translate-x-1 transition-transform duration-200">
                  <svg
                    className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
              </div>
              <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Promoted from sandbox. Rebase from sandbox when you want to refresh
            a page’s layout.
          </p>
        </div>
      </div>
    </Page>
  );
}
