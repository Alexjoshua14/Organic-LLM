import type { Metadata } from "next";

import { KnowledgeCapsulesLab } from "./_components/knowledge-capsules-lab";

import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Knowledge capsules"),
};

export default function KnowledgeCapsulesLabPage() {
  return <KnowledgeCapsulesLab />;
}
