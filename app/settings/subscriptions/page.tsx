import { redirect } from "next/navigation";

import SubscriptionConnectionSettings from "./subscription-connection-settings";

import { requireProfileActor } from "@/lib/api/profile-actor";
import { PageContentFrame } from "@/components/layout/page-content-frame";

export default async function SubscriptionSettingsPage() {
  const { actor } = await requireProfileActor();

  if (!actor) redirect("/sign-in");

  return (
    <PageContentFrame maxWidth="3xl">
      <SubscriptionConnectionSettings />
    </PageContentFrame>
  );
}
