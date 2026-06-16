import type { ComponentType } from "react";

import { WelcomeArcadiaIllustration } from "./welcome-arcadia-illustration";
import { WelcomeEncryptedAtRestIllustration } from "./welcome-encrypted-at-rest-illustration";
import { WelcomeGenUiIllustration } from "./welcome-gen-ui-illustration";
import { WelcomeMainChatIllustration } from "./welcome-main-chat-illustration";
import { WelcomeModelSelectionIllustration } from "./welcome-model-selection-illustration";
import { WelcomeNoesisIllustration } from "./welcome-noesis-illustration";
import { WelcomeStrataIllustration } from "./welcome-strata-illustration";
import { WelcomeStreamResumeIllustration } from "./welcome-stream-resume-illustration";

/** Maps welcome visual slot ids to inline SVG illustrations. */
export const welcomeIllustrations: Record<string, ComponentType<{ className?: string }>> = {
  security: WelcomeEncryptedAtRestIllustration,
  streaming: WelcomeStreamResumeIllustration,
  models: WelcomeModelSelectionIllustration,
  "gen-ui": WelcomeGenUiIllustration,
  "feature-chat": WelcomeMainChatIllustration,
  "feature-arcadia": WelcomeArcadiaIllustration,
  "feature-noesis": WelcomeNoesisIllustration,
  "feature-strata": WelcomeStrataIllustration,
};

export type WelcomeIllustrationId = keyof typeof welcomeIllustrations;
