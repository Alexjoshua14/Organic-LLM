import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LiquidChromeSsrFill id="showcase-liquid-chrome-ssr-fill" />
      {children}
    </>
  );
}
