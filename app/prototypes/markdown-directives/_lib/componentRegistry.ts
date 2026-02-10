/**
 * Maps directive names (from markdown, e.g. "knowledge-card") to React components.
 * Used by DirectiveRenderer to replace custom elements with the right UI.
 * Add new entries here when you add a new directive component.
 */

import type { ComponentType } from "react";
import { KnowledgeCard } from "../_components/KnowledgeCard";
import { Timeline } from "../_components/Timeline";
import { DataTable } from "../_components/DataTable";

/** Props passed to every directive component: the parsed attributes from the directive. */
export type DirectiveProps = Record<string, string | number | boolean | undefined>;

export const COMPONENT_REGISTRY: Record<string, ComponentType<DirectiveProps>> = {
  "knowledge-card": KnowledgeCard,
  timeline: Timeline,
  "data-table": DataTable,
};

export function getDirectiveComponent(name: string): ComponentType<DirectiveProps> | undefined {
  return COMPONENT_REGISTRY[name];
}
