import Page from "@/components/layout/page";

/**
 * Blog pages scroll top to bottom from the top of the page. `Page` centres its content
 * vertically by default, which floats short pages in a gap and clips the top of long ones, so the
 * blog starts content at the top instead. Width, gutters and the reading column belong to
 * `BlogArticleShell` and the blog index, not to this layout.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <Page className="justify-start overflow-y-auto bg-background text-foreground">{children}</Page>
  );
}
