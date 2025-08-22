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
