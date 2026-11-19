import Page from "@/components/layout/page";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  // Start-aligned: Page centres its column, which clips the top of any post taller than the screen.
  return (
    <Page className="justify-start overflow-auto bg-background text-foreground">{children}</Page>
  );
}
