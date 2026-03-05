import Page from "@/components/layout/page";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Page className="bg-background text-foreground">
      {children}
    </Page>
  );
}
