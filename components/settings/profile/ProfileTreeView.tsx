"use client";

import type { ProfileSection, ProfileTree } from "@/lib/schemas/profileTree";

type ProfileTreeViewProps = {
  tree: ProfileTree;
  /** When true, sections use placeholder styling (dashed, muted). */
  isPlaceholder?: boolean;
};

function SectionNode({
  section,
  depth,
  isPlaceholder,
}: {
  section: ProfileSection;
  depth: number;
  isPlaceholder?: boolean;
}) {
  const hasContent = Boolean(
    section.body?.trim() ||
      (section.items?.length ?? 0) > 0 ||
      (section.children?.length ?? 0) > 0,
  );
  const wrapperClass = hasContent && !isPlaceholder
    ? "rounded-xl border border-border bg-card/50 px-5 py-5 backdrop-blur-sm md:px-6 md:py-6"
    : "rounded-xl border border-dashed border-border bg-muted/30 px-5 py-5 md:px-6 md:py-6";

  return (
    <section
      className={wrapperClass}
      aria-labelledby={section.id}
      style={depth > 0 ? { marginLeft: "1rem" } : undefined}
    >
      <h2
        id={section.id}
        className={`mb-3 text-xs font-semibold uppercase tracking-wider ${
          isPlaceholder ? "text-muted-foreground" : "text-muted-foreground"
        }`}
      >
        {section.title}
      </h2>
      {section.body && (
        <p
          className={
            isPlaceholder
              ? "max-w-[65ch] text-sm leading-relaxed text-muted-foreground italic"
              : "max-w-[65ch] text-sm leading-[1.65] text-foreground md:text-[15px]"
          }
        >
          {section.body}
        </p>
      )}
      {section.items && section.items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {section.items.map((item: string, i: number) => (
            <span
              key={`${section.id}-${i}`}
              className={
                isPlaceholder
                  ? "rounded-full bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  : "rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
              }
            >
              {item}
            </span>
          ))}
        </div>
      )}
      {section.children && section.children.length > 0 && (
        <div className="mt-4 space-y-4">
          {section.children.map((child: ProfileSection) => (
            <SectionNode
              key={child.id}
              section={child}
              depth={depth + 1}
              isPlaceholder={isPlaceholder}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function ProfileTreeView({ tree, isPlaceholder }: ProfileTreeViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {tree.sections.map((section) => (
        <SectionNode
          key={section.id}
          section={section}
          depth={0}
          isPlaceholder={isPlaceholder}
        />
      ))}
    </div>
  );
}
