import Page from "@/components/layout/page";
import { BackToHomeButton } from "@/components/layout/back-to-home-button";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Page className="bg-background text-foreground">
      <div className="w-full max-w-2xl mx-auto flex flex-col h-full">
        <div className="px-6 pt-14 flex justify-start">
          <BackToHomeButton />
        </div>
        {children}
      </div>
    </Page>
  );
}
