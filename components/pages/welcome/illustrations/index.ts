import type { ComponentType } from "react";

import { WelcomeEncryptedAtRestIllustration } from "./welcome-encrypted-at-rest-illustration";
import { WelcomeGenUiIllustration } from "./welcome-gen-ui-illustration";
import { WelcomeModelSelectionIllustration } from "./welcome-model-selection-illustration";
import { WelcomeStreamResumeIllustration } from "./welcome-stream-resume-illustration";

/** Maps welcome visual slot ids to inline SVG illustrations. */
export const welcomeIllustrations: Record<string, ComponentType<{ className?: string }>> = {
  security: WelcomeEncryptedAtRestIllustration,
  streaming: WelcomeStreamResumeIllustration,
  models: WelcomeModelSelectionIllustration,
  "gen-ui": WelcomeGenUiIllustration,
};

export type WelcomeIllustrationId = keyof typeof welcomeIllustrations;
