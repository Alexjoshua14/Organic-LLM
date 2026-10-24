export type RestaurantCardViewTransitionNames = {
  hero: string;
  title: string;
  rating: string;
};

/** Shared view-transition-class for hero clip morph styling in CSS. */
export const RESTAURANT_CARD_HERO_VT_CLASS = "restaurant-card-hero";
export const RESTAURANT_CARD_TITLE_VT_CLASS = "restaurant-card-title";
export const RESTAURANT_CARD_RATING_VT_CLASS = "restaurant-card-rating";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 48);
}

/** Stable view-transition names scoped per venue (name + hero URL). */
export function restaurantCardViewTransitionNames(input: {
  name: string;
  heroUrl: string;
}): RestaurantCardViewTransitionNames {
  const slug = slugify(`${input.name}-${input.heroUrl.slice(-32)}`) || "venue";

  return {
    hero: `rc-${slug}-hero`,
    title: `rc-${slug}-title`,
    rating: `rc-${slug}-rating`,
  };
}
