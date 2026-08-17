/**
 * Shared styling for the halves of the model + effort segmented control.
 *
 * `SelectTrigger` hardcodes its chevron as a trailing `SelectPrimitive.Icon`,
 * so hiding it has to happen in CSS — it targets the trigger's last direct
 * child svg, which is always the chevron (select values are nested in a span).
 */
export const composerSelectSegmentClasses =
  "h-8 min-w-0 shrink-0 px-2 text-xs [&>svg:last-child]:hidden";
