/**
 * Insight paging with "Follow latest" (COA-755). While following, the card shows the newest
 * turn, so a turn that starts moves Insight to it immediately. Paging back stops following;
 * paging forward onto the newest turn, or pressing the toggle, follows again.
 */
export type InsightPager = { follow: boolean; index: number };

export type InsightPagerAction =
  | { type: "prev"; count: number }
  | { type: "next"; count: number }
  | { type: "toggle"; count: number };

export function initialInsightPager(follow = true): InsightPager {
  return { follow, index: 0 };
}

/** The page on screen for `count` pages (0 when there are none). */
export function insightPage(pager: InsightPager, count: number): number {
  if (count <= 0) return 0;

  return pager.follow ? count - 1 : Math.min(Math.max(0, pager.index), count - 1);
}

export function insightPagerReducer(pager: InsightPager, action: InsightPagerAction): InsightPager {
  const last = Math.max(0, action.count - 1);
  const current = insightPage(pager, action.count);

  switch (action.type) {
    case "prev": {
      const index = Math.max(0, current - 1);

      return { follow: action.count > 0 && index === last && pager.follow, index };
    }
    case "next": {
      const index = Math.min(last, current + 1);

      return { follow: index === last, index };
    }
    case "toggle":
      // Turning it off keeps the page you are on; turning it on jumps to the newest.
      return pager.follow ? { follow: false, index: current } : { follow: true, index: last };
  }
}
