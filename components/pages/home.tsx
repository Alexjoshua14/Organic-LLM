import Page from "../layout/page";

import LiquidChrome from "@/components/background/LiquidChrome";

export default function Home() {
  return (
    <>
      <LiquidChrome />
      <Page transparentBackground>
        <div className="relative inline-block max-w-4xl h-full w-full text-center justify-center">
          <div className="w-full max-w-5xl mx-auto p-8 space-y-8">
            <h1 className="text-3xl font-bold ">How can I help you?</h1>
          </div>
        </div>
      </Page>
    </>
  );
}
