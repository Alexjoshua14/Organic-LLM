import Page from "./page";

import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";

type LiquidChromePageProps = Omit<React.ComponentProps<typeof Page>, "liquidChromeBackground">;

/** Server wrapper: paints chrome gradient before the client Page tree streams. */
export default function LiquidChromePage(props: LiquidChromePageProps) {
  return (
    <>
      <LiquidChromeSsrFill />
      <Page {...props} liquidChromeBackground />
    </>
  );
}
