import Link from "next/link";

const PROTOTYPES = [
  {
    slug: "markdown-directives",
    title: "Extended Markdown Directives",
    description: "MVP for directive syntax: parse, render, and hydrate custom components from markdown.",
  },
] as const;

export default function PrototypesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold">Prototypes</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Isolated experiments. Not wired into main app flows.
      </p>
      <ul className="space-y-4">
        {PROTOTYPES.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/prototypes/${p.slug}`}
              className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
            >
              <span className="font-medium text-foreground">{p.title}</span>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              <span className="mt-2 inline-block text-xs text-muted-foreground">/prototypes/{p.slug} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
