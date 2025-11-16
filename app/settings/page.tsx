"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import Page from "@/components/layout/page";
import { ReturnButton } from "@/components/ReturnButton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/third-party/ui/tabs";
import { getProfile } from "@/data/supabase/profiles";
import { Profile } from "@/lib/schemas/profiles";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>();
  const { userId } = useAuth();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;
      const supabaseProfile = await getProfile(userId);

      if (
        !supabaseProfile ||
        supabaseProfile.error ||
        supabaseProfile.data === null
      )
        return;
      setProfile(supabaseProfile.data);
    };

    fetchUserProfile();
  }, [userId]);

  return (
    <Page>
      <div className="flex items-center justify-start w-full h-14 px-8 border-2 border-teal-700">
        <ReturnButton />
      </div>
      <div className="flex-1 flex flex-row gap-8 w-full px-4">
        <section className="max-w-lg border-2 border-yellow-700 ">
          <Suspense fallback={<div>Loading...</div>}>
            {profile && <p>{profile.display_name}</p>}
          </Suspense>
        </section>
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="customization">Customization</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <h1>Profile</h1>
          </TabsContent>

          <TabsContent value="customization">
            <h1>Customization</h1>
          </TabsContent>

          <TabsContent value="memory">
            <h1>Memory</h1>
          </TabsContent>
        </Tabs>
      </div>
    </Page>
  );
}
