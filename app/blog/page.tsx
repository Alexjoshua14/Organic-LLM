import Link from "next/link";

const POSTS = [
  {
    slug: "adaptive-liquid-chrome",
    title: "Adaptive Liquid Chrome",
    description:
      "Documentation for the full-viewport adaptive background that dims on hover/focus and brightens in two phases.",
  },
];

export default function BlogPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground mb-2">Blog</h1>
      <p className="text-secondary-foreground text-sm mb-8">
        Design and implementation notes. Not linked in the main UI yet.
      </p>
      <ul className="space-y-4">
        {POSTS.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="block rounded-lg border border-border bg-secondary p-4 transition-colors hover:bg-secondary/80 text-foreground no-underline"
            >
              <h2 className="font-medium text-foreground">{post.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {post.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
