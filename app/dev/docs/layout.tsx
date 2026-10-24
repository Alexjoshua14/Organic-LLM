import Page from "@/components/layout/page";

export default function DevDocsLayout({ children }: { children: React.ReactNode }) {
  return <Page className="overflow-auto bg-background text-foreground">{children}</Page>;
}
