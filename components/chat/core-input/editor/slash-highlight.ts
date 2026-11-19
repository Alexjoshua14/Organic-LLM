import type { EditorState } from "@tiptap/pm/state";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** The `/query` typed on the caret's line; `split` when the line follows a Shift+Enter break. */
export type TypedSlash = { from: number; to: number; query: string; split: boolean };

type SlashHighlightOptions = {
  /** Commands the surface runs (`btw`); a draft that starts with one keeps it highlighted. */
  appCommandIds: () => readonly string[];
  /** The command the slash menu would run for this query, completed after the caret. */
  complete: (slash: TypedSlash) => string | null;
};

/** Transaction meta that redraws the highlight after the composer's state changes. */
export const SLASH_HIGHLIGHT_REFRESH = "composerSlashHighlightRefresh";

const key = new PluginKey("composerSlashHighlight");

/** The `/query` being typed on the caret's line, as document positions, or null. */
function typedSlash(state: EditorState): TypedSlash | null {
  const { $from, empty } = state.selection;

  if (!empty || $from.parent.type.name !== "paragraph") return null;
  if ($from.marks().some((mark) => mark.type.name === "code")) return null;
  let lineStart = 0;
  let breakAt = -1;

  $from.parent.forEach((child, offset) => {
    if (child.type.name === "hardBreak" && offset + child.nodeSize <= $from.parentOffset) {
      lineStart = offset + child.nodeSize;
      breakAt = offset;
    }
  });
  const text = $from.parent.textBetween(lineStart, $from.parentOffset, "\n", "￼");
  const match = /^\/([a-z]*)$/i.exec(text);

  if (!match) return null;

  // `from` covers a preceding break, as the menu's own match does (editor-model.ts).
  return {
    from: $from.start() + (breakAt >= 0 ? breakAt : 0),
    to: $from.pos,
    query: match[1].toLowerCase(),
    split: breakAt >= 0,
  };
}

/** A surface command the draft starts with (`/btw …`), as positions, or null. */
function leadingCommand(state: EditorState, ids: readonly string[]) {
  const first = state.doc.firstChild;

  if (!first || first.type.name !== "paragraph") return null;
  const match = /^\/([a-z][\w-]*)(?=\s|$)/i.exec(first.textContent);

  if (!match || !ids.includes(match[1].toLowerCase())) return null;

  return { from: 1, to: 1 + match[0].length };
}

function ghost(text: string) {
  const span = document.createElement("span");

  span.className = "composer-slash-ghost";
  span.setAttribute("aria-hidden", "true");
  span.textContent = text;

  return span;
}

/**
 * A slash command in the draft wears the warm accent (`--accent-warm`): the `/query` being typed,
 * with the menu's active command completed after the caret in a muted variant, and a surface
 * command the draft starts with until it is sent. Purely visual; the Markdown is unchanged.
 */
export const SlashHighlight = Extension.create<SlashHighlightOptions>({
  name: "composerSlashHighlight",

  addOptions() {
    return { appCommandIds: () => [], complete: () => null };
  },

  addProseMirrorPlugins() {
    const { appCommandIds, complete } = this.options;

    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const typed = typedSlash(state);
            const leading = leadingCommand(state, appCommandIds());

            if (leading && !typed) {
              decorations.push(
                Decoration.inline(leading.from, leading.to, { class: "composer-slash-token" })
              );
            }
            if (typed) {
              // The token itself: after the break, if the line follows one.
              decorations.push(
                Decoration.inline(typed.to - typed.query.length - 1, typed.to, {
                  class: "composer-slash-token",
                })
              );
              const id = complete(typed);
              const rest = id && id.startsWith(typed.query) ? id.slice(typed.query.length) : "";

              if (rest) {
                decorations.push(
                  Decoration.widget(typed.to, () => ghost(rest), {
                    side: 1,
                    key: `slash-ghost-${rest}`,
                    ignoreSelection: true,
                  })
                );
              }
            }

            return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
          },
        },
      }),
    ];
  },
});
