import Page from "@/components/layout/page";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <Page className="bg-background text-foreground">
      <div className="w-full sm:max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl mx-auto flex flex-col h-full">
        {children}
      </div>
    </Page>
  );
}
