"use client";

import type { RestaurantLinks } from "@/lib/schemas/gen-ui/restaurant-card";

import type { ReactNode } from "react";

import { ExternalLink, MapPin, Phone } from "lucide-react";

import { buildDirectionsHref, buildTelHref } from "./restaurant-card-utils";
import { cn } from "@/lib/utils";

type RestaurantCardActionsProps = {
  address?: string;
  phone?: string;
  links?: RestaurantLinks;
  size?: "default" | "large";
};

function ActionButton({
  href,
  label,
  icon,
  large,
  external,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  large?: boolean;
  external?: boolean;
}) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/80 font-medium text-foreground transition-colors hover:bg-muted/50",
        large ? "flex-1 px-4 py-3 text-sm" : "px-3 py-2 text-xs"
      )}
      href={href}
      rel={external ? "noopener noreferrer nofollow" : undefined}
      target={external ? "_blank" : undefined}
    >
      {icon}
      {label}
    </a>
  );
}

export function RestaurantCardActions({
  address,
  phone,
  links,
  size = "default",
}: RestaurantCardActionsProps) {
  const large = size === "large";
  const directionsHref =
    address || links?.directions
      ? buildDirectionsHref(address ?? "", links)
      : links?.googleMaps;

  return (
    <div className={cn("flex flex-wrap gap-2", large && "grid grid-cols-2 sm:flex")}>
      {directionsHref ? (
        <ActionButton
          external
          href={directionsHref}
          icon={<MapPin className="size-4" />}
          label="Directions"
          large={large}
        />
      ) : null}
      {phone ? (
        <ActionButton
          href={buildTelHref(phone)}
          icon={<Phone className="size-4" />}
          label="Call"
          large={large}
        />
      ) : null}
      {links?.website ? (
        <ActionButton
          external
          href={links.website}
          icon={<ExternalLink className="size-4" />}
          label="Website"
          large={large}
        />
      ) : null}
      {links?.yelp ? (
        <ActionButton
          external
          href={links.yelp}
          icon={<ExternalLink className="size-4" />}
          label="Yelp"
          large={large}
        />
      ) : null}
    </div>
  );
}
