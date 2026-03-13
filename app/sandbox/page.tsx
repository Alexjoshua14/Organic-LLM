import Link from "next/link";

import Page from "@/components/layout/page";

export default function SandboxPage() {
  const sandboxPages = [
    {
      title: "Ideas",
      description:
        "Capture, organize, and manage your creative ideas with priority levels and status tracking",
      href: "/sandbox/ideas",
      icon: "💡",
      size: "large", // Takes up more space in the bento grid
      gradient: "from-yellow-400/20 to-orange-500/20",
      hoverGradient: "hover:from-yellow-400/30 hover:to-orange-500/30",
    },
    {
      title: "Tasks",
      description:
        "Full-featured task management with client and server-side functionality",
      href: "/sandbox/tasks",
      icon: "✅",
      size: "large",
      gradient: "from-blue-400/20 to-purple-500/20",
      hoverGradient: "hover:from-blue-400/30 hover:to-purple-500/30",
    },
    {
      title: "Quick Tasks",
      description: "Streamlined server-side task creation",
      href: "/sandbox/tasks/server",
      icon: "⚡",
      size: "small",
      gradient: "from-green-400/20 to-teal-500/20",
      hoverGradient: "hover:from-green-400/30 hover:to-teal-500/30",
    },
    {
      title: "Text-to-Speech",
      description:
        "Generate speech-friendly responses optimized for audio playback",
      href: "/sandbox/tts",
      icon: "🔊",
      size: "large",
      gradient: "from-purple-400/20 to-pink-500/20",
      hoverGradient: "hover:from-purple-400/30 hover:to-pink-500/30",
    },
    {
      title: "Prometheus",
      description:
        "Advanced AI interface with organic design and 3D visualization placeholder",
      href: "/sandbox/prometheus",
      icon: "🔥",
      size: "large",
      gradient: "from-green-400/20 to-emerald-500/20",
      hoverGradient: "hover:from-green-400/30 hover:to-emerald-500/30",
    },
    {
      title: "Prototypes",
      description:
        "UI and background experiments — silk-fabric gradient and more",
      href: "/sandbox/prototypes",
      icon: "✨",
      size: "small",
      gradient: "from-stone-300/20 to-amber-200/20",
      hoverGradient: "hover:from-stone-300/30 hover:to-amber-200/30",
    },
    {
      title: "Memory",
      description:
        "Persisted memory lens, cards, and ephemeral in-chat preview",
      href: "/sandbox/memory",
      icon: "🧠",
      size: "small",
      gradient: "from-cyan-400/20 to-emerald-500/20",
      hoverGradient: "hover:from-cyan-400/30 hover:to-emerald-500/30",
    },
    {
      title: "Sandbox Platform",
      description:
        "Inspect and test real UI components, pipelines, and LLM-backed functions (Rabbit Holes scenarios)",
      href: "/sandbox/platform",
      icon: "🔬",
      size: "large",
      gradient: "from-violet-400/20 to-indigo-500/20",
      hoverGradient: "hover:from-violet-400/30 hover:to-indigo-500/30",
    },
  ];

  return (
    <Page>
      <div className="w-full max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            Sandbox Gateway
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Welcome to your development playground. Explore and experiment with
            different features and tools.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
          {sandboxPages.map((page) => (
            <Link
              key={page.href}
              className={`
                group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 
                bg-gradient-to-br ${page.gradient} ${page.hoverGradient}
                transition-all duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-xl
                ${page.size === "large" ? "md:col-span-1 lg:row-span-2" : "md:col-span-1"}
                p-6 flex flex-col justify-between min-h-[200px]
              `}
              href={page.href}
            >
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white to-transparent transform rotate-12 scale-150" />
              </div>

              {/* Content */}
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

              {/* Arrow indicator */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
                  Explore
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

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </Link>
          ))}

          {/* Add more placeholder card for future sandbox pages */}
          <div className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 transition-colors duration-300 p-6 flex flex-col items-center justify-center min-h-[200px] bg-gray-50/50 dark:bg-gray-900/50">
            <div className="text-4xl mb-4 opacity-60">➕</div>
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
              Coming Soon
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-500 text-center">
              More sandbox experiments will appear here as you build them
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Each sandbox is a self-contained experiment. Feel free to break
            things and learn! 🚀
          </p>
        </div>
      </div>
    </Page>
  );
}
