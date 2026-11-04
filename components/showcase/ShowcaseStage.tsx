"use client";

import type { ShowcaseTourSlug } from "@/lib/showcase/feature-tour";

import dynamic from "next/dynamic";

import { GenerativeUIStage } from "./GenerativeUIStage";

function LoadingDemo() {
  return (
    <div aria-label="Loading demo" className="showcase-demo-loading" role="status">
      <div />
      <div />
      <div />
      <span className="sr-only">Loading demo…</span>
    </div>
  );
}

const RabbitHolesStage = dynamic(
  () => import("./rabbit-holes/RabbitHolesShowcaseStage").then((m) => m.RabbitHolesShowcaseStage),
  { loading: LoadingDemo }
);
const ContextStage = dynamic(
  () => import("./context-controls/ContextControlsStage").then((m) => m.ContextControlsStage),
  { loading: LoadingDemo }
);
const VoiceStage = dynamic(
  () => import("./voice/VoiceShowcaseStage").then((m) => m.VoiceShowcaseStage),
  { loading: LoadingDemo }
);
const ModelsStage = dynamic(
  () => import("./models-and-usage/ModelsAndUsageStage").then((m) => m.ModelsAndUsageStage),
  { loading: LoadingDemo }
);

/** The interactive demo for a feature. Each stage uses production components and local data. */
export function ShowcaseStage({ slug }: { slug: ShowcaseTourSlug }) {
  switch (slug) {
    case "rabbit-holes":
      return <RabbitHolesStage />;
    case "generative-ui":
      return <GenerativeUIStage />;
    case "voice":
      return <VoiceStage />;
    case "context-controls":
      return <ContextStage />;
    case "models-and-usage":
      return <ModelsStage />;
  }
}
