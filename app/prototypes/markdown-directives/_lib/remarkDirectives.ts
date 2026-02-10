/**
 * Remark plugin: ensures directive nodes (from remark-directive) are HAST-ready
 * so that remark-rehype emits custom elements we can map to React components.
 *
 * Flow: remark-directive parses `::name{ key="value" }` into mdast nodes with
 * type leafDirective/textDirective/containerDirective. This plugin visits those
 * nodes and sets node.data.hName and node.data.hProperties. When remark-rehype
 * runs, it creates hast elements with that tag name and attributes, which
 * react-markdown then passes to the `components` map.
 *
 * Edge cases: attributes from micromark may be string/number/boolean; we pass
 * them through. Empty or invalid attributes are left as-is (no strict validation in MVP).
 */

import type { Root } from "mdast";
import type { Plugin } from "unified";

const DIRECTIVE_TYPES = ["leafDirective", "textDirective", "containerDirective"] as const;

type DirectiveNode = { type: string; name?: string; attributes?: Record<string, string | number | boolean | undefined>; data?: Record<string, unknown> };

function visit(
  tree: Root,
  predicate: (node: { type: string }) => boolean,
  fn: (node: DirectiveNode) => void
): void {
  function walk(node: { type: string; children?: unknown[] } & DirectiveNode): void {
    if (predicate(node)) fn(node);
    const children = (node as { children?: { type: string; children?: unknown[] }[] }).children;
    if (children) for (const child of children) walk(child as Parameters<typeof walk>[0]);
  }
  walk(tree as Parameters<typeof walk>[0]);
}

/**
 * Remark plugin. Use after remark-directive so directive nodes exist.
 * Transforms each directive node so it becomes a custom element in the HAST.
 */
export const remarkDirectivesToHast: Plugin<[], Root> = function () {
  return (tree) => {
    visit(tree, (node) => DIRECTIVE_TYPES.includes(node.type as (typeof DIRECTIVE_TYPES)[number]), (node) => {
      const name = node.name ?? "unknown";
      const attrs = node.attributes ?? {};
      const data = node.data ?? (node.data = {});
      // Single custom tag so we can handle unknown directives in one component.
      (data as Record<string, unknown>).hName = "directive-leaf";
      (data as Record<string, unknown>).hProperties = { dataDirectiveName: name, ...attrs };
    });
  };
};
