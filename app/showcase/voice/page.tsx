import type { Metadata } from "next";

import { ShowcaseDemoFrame } from "@/components/showcase/ShowcaseDemoFrame";
import { VoiceShowcaseStage } from "@/components/showcase/voice/VoiceShowcaseStage";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Voice"),
  description:
    "A scripted hands-free exchange in the field: the voice bar listens, then answers with a starting shutter speed. Synthetic waveform only — no microphone and no live session.",
};

export default function VoiceShowcasePage() {
  return (
    <ShowcaseDemoFrame
      disclosure="Scripted demo · synthetic data · no microphone and no live voice session"
      slug="voice"
      title="Voice"
      value="Ask for a starting exposure hands-free, while your hands stay on the tripod."
    >
      <VoiceShowcaseStage />
    </ShowcaseDemoFrame>
  );
}
