import Page from "@/components/layout/page";
import { BackToHomeButton } from "@/components/layout/back-to-home-button";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Page className="bg-background text-foreground">
      <div className="w-full sm:max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl mx-auto flex flex-col h-full">
        <div className="px-6 pt-14 flex justify-start">
          <BackToHomeButton />
        </div>
        {children}
      </div>
    </Page>
  );
}
