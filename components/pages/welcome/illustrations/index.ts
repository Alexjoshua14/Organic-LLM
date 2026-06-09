import type { ComponentType } from "react";

import { WelcomeEncryptedAtRestIllustration } from "./welcome-encrypted-at-rest-illustration";

/** Maps welcome visual slot ids to inline SVG illustrations. */
export const welcomeIllustrations: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  security: WelcomeEncryptedAtRestIllustration,
};

export type WelcomeIllustrationId = keyof typeof welcomeIllustrations;
