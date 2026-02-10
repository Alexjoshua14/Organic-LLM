"use client";

/**
 * Renders markdown that may contain leaf directives (::name{ key="value" }).
 *
 * Flow:
 * 1. remark-parse + remark-gfm + remark-directive parse the string into mdast.
 * 2. remarkDirectivesToHast turns directive nodes into <directive-leaf> nodes with dataDirectiveName + props.
 * 3. remark-rehype converts mdast to hast (so we get directive-leaf elements).
 * 4. ReactMarkdown renders; we map "directive-leaf" to DirectiveLeafWrapper, which looks up the real component and renders it or an unknown fallback.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { remarkDirectivesToHast } from "../_lib/remarkDirectives";
import { getDirectiveComponent } from "../_lib/componentRegistry";
import type { DirectiveProps } from "../_lib/componentRegistry";

type DirectiveLeafProps = React.ComponentPropsWithoutRef<"div"> & {
  dataDirectiveName?: string;
  [key: string]: string | number | boolean | undefined | unknown;
};

function DirectiveLeafWrapper({ dataDirectiveName, children, ...rest }: DirectiveLeafProps) {
  const name = dataDirectiveName ?? "unknown";
  const Component = getDirectiveComponent(name);
  const props: DirectiveProps = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k !== "node" && (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === undefined))
      props[k] = v;
  }
  if (Component) return <Component {...props} />;
  return (
    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-sm text-amber-800 dark:text-amber-200">
      Unknown directive: {name}
    </span>
  );
}

const remarkPlugins = [remarkGfm, remarkDirective, remarkDirectivesToHast];

export function DirectiveRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={{
        "directive-leaf": DirectiveLeafWrapper,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
