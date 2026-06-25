import Script from "next/script";
import { cookies } from "next/headers";

import { ErgonChromeProvider } from "@/components/ergon/ErgonChromeProvider";
import { ErgonLiquidChromePageFill } from "@/components/ergon/ErgonLiquidChromePageFill";
import { ERGON_LIQUID_CHROME_COOKIE_BACKFILL } from "@/lib/ergon/liquid-chrome-bootstrap";
import {
  ERGON_LIQUID_CHROME_COOKIE_NAME,
  getErgonLiquidChromeFromCookieValue,
} from "@/lib/ergon/liquid-chrome-cookie";

export default async function ErgonLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const liquidChromeEnabled = getErgonLiquidChromeFromCookieValue(
    cookieStore.get(ERGON_LIQUID_CHROME_COOKIE_NAME)?.value
  );

  return (
    <ErgonChromeProvider liquidChromeEnabled={liquidChromeEnabled}>
      <Script
        dangerouslySetInnerHTML={{ __html: ERGON_LIQUID_CHROME_COOKIE_BACKFILL }}
        id="ergon-liquid-chrome-cookie-backfill"
        strategy="beforeInteractive"
      />
      <ErgonLiquidChromePageFill />
      {children}
    </ErgonChromeProvider>
  );
}
