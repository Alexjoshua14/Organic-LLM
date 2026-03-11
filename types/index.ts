import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type ThreadLink = {
  title: string;
  id: string;
  pinned: boolean;
  date: string;
  /** True when the thread has no title (null or empty); used to show "Generate title (AI)" in the sidebar menu. */
  hasNoTitle?: boolean;
};

export type Result<T, E = Error> = {
  data: T | null;
  error: E | null;
};

export type SimpleResult = {
  ok: boolean;
  error: Error | null;
};
