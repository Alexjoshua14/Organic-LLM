import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";

import Page from "./page";

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
