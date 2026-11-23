"use client";

import type { ProfileMapBlock as ProfileMapBlockData, ProfileNode } from "@/lib/schemas/gen-ui";

import { ProfileMapView } from "../profile-map/ProfileMapView";

type ProfileMapProps = {
  block: ProfileMapBlockData;
  partial?: boolean;
  onEdit?: (node: ProfileNode) => void;
  onDelete?: (node: ProfileNode) => void;
};

export function ProfileMap({ block, partial, onEdit, onDelete }: ProfileMapProps) {
  return (
    <ProfileMapView block={block} partial={partial} onEdit={onEdit} onDelete={onDelete} />
  );
}
