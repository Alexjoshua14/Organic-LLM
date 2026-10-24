import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LiquidChromeSsrFill id="status-liquid-chrome-ssr-fill" />
      {children}
    </>
  );
}
