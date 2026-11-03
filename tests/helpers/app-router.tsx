import type { ReactNode } from "react";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** The router `useRouter()` needs, with calls recorded for assertions. */
export const appRouter = {
  push: (href: string) => void appRouter.calls.push({ method: "push", href }),
  replace: (href: string) => void appRouter.calls.push({ method: "replace", href }),
  back: () => {},
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
  calls: [] as Array<{ method: "push" | "replace"; href: string }>,
};

/** Wrap a tree that calls `useRouter()` outside the real app router. */
export function AppRouterProvider({ children }: { children: ReactNode }) {
  return <AppRouterContext.Provider value={appRouter}>{children}</AppRouterContext.Provider>;
}
