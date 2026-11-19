import { auth } from "@clerk/nextjs/server";

import Page from "@/components/layout/page";
import { ShowcaseNav } from "@/components/showcase/ShowcaseNav";

import "../showcase/showcase.css";

/**
 * Blog pages scroll top to bottom from the top of the page. `Page` centres its content
 * vertically by default, which floats short pages in a gap and clips the top of long ones, so the
 * blog starts content at the top instead. Width, gutters and the reading column belong to
 * `BlogArticleShell` and the blog index, not to this layout.
 *
 * Visitors who are not signed in get Showcase's public header in place of the app sidebar (which
 * `AppOnlyChrome` hides for them), so the blog reads like the rest of the public site. Signed-in
 * readers keep the sidebar and the page as before.
 */
export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const page = (
    <Page className="justify-start overflow-y-auto bg-background text-foreground">{children}</Page>
  );

  if (userId) return page;

  return (
    <div className="showcase-layout">
      <ShowcaseNav />
      <div className="showcase-route">{page}</div>
    </div>
  );
}
