"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

const isUnder = (pathname: string | null, base: string) =>
  pathname === base || Boolean(pathname?.startsWith(`${base}/`));

/**
 * Whether the workspace chrome (sidebar, controls) is hidden on a route. The public showcase has
 * its own navigation. The blog is public reading, so visitors who are not signed in get the page
 * alone rather than a sidebar that only offers sign-in; signed-in readers keep their sidebar.
 */
export function hidesAppChrome(pathname: string | null, signedIn: boolean): boolean {
  if (isUnder(pathname, "/showcase")) return true;
  return !signedIn && isUnder(pathname, "/blog");
}

export function AppOnlyChrome({
  children,
  signedIn,
}: {
  children: ReactNode;
  /** Known on the server, so the first paint matches and the sidebar never flashes. */
  signedIn: boolean;
}) {
  const pathname = usePathname();

  if (hidesAppChrome(pathname, signedIn)) return null;

  return <>{children}</>;
}
