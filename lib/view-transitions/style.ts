import type { CSSProperties } from "react";

type ViewTransitionStyleOptions = {
  viewTransitionClass?: string;
};

export function viewTransitionStyle(
  name: string,
  options?: ViewTransitionStyleOptions
): CSSProperties {
  const style: CSSProperties = { viewTransitionName: name };

  if (options?.viewTransitionClass) {
    style.viewTransitionClass = options.viewTransitionClass;
  }

  return style;
}
