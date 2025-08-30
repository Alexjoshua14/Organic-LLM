import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type ThreadLink = {
  title: string;
  id: string;
  pinned: boolean;
  date: string;
};

export type Result<T, E = Error> = {
  data: T | null;
  error: E | null;
};

export type SimpleResult = {
  ok: boolean;
  error: Error | null;
};
