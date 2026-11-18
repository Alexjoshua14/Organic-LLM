import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { Extension, getMarkRange } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { preloadLanguage, tokenizeCode } from "@/components/shared/code-highlight";

/** The body font's backtick has zero advance; give literal syntax a real character width. */
function literalBackticks(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos, parent) => {
    if (
      !node.isText ||
      parent?.type.spec.code ||
      node.marks.some((mark) => mark.type.name === "code")
    )
      return;
    for (const match of (node.text ?? "").matchAll(/`+/g)) {
      decorations.push(
        Decoration.inline(pos + match.index!, pos + match.index! + match[0].length, {
          class: "editor-literal-backticks",
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

/** Active delimiters are UI, never document text, so copying/sending cannot duplicate fences. */
export const EditableCodeDelimiters = Extension.create({
  name: "editableCodeDelimiters",
  priority: 1000,
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>("editableCodeDelimiters");

    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => literalBackticks(state.doc),
          apply: (transaction, previous) =>
            transaction.docChanged ? literalBackticks(transaction.doc) : previous,
        },
        props: {
          decorations(state) {
            const base = key.getState(state) ?? DecorationSet.empty;

            if (!state.selection.empty) return base;
            const range = getMarkRange(state.selection.$from, state.schema.marks.code);

            if (!range) return base;
            const delimiter = (position: number, closing: boolean) =>
              Decoration.widget(
                position,
                (view) => {
                  const anchor = document.createElement("span");
                  const marker = document.createElement("span");

                  anchor.className = "editor-code-delimiter-anchor";
                  anchor.contentEditable = "false";
                  anchor.setAttribute("aria-hidden", "true");
                  marker.className = `editor-code-delimiter ${closing ? "editor-code-delimiter-close" : "editor-code-delimiter-open"}`;
                  marker.textContent = "`";
                  anchor.append(marker);
                  anchor.onmousedown = (event) => {
                    event.preventDefault();
                    view.dispatch(
                      view.state.tr.setSelection(TextSelection.create(view.state.doc, position))
                    );
                    view.focus();
                  };

                  return anchor;
                },
                {
                  // Both widgets precede the caret at their document position. In particular,
                  // a just-typed closing delimiter must sit behind the caret, not ahead of it.
                  side: -1,
                  key: `code-delimiter-${range.from}-${range.to}-${position}-${closing}`,
                  marks: [],
                  stopEvent: () => true,
                }
              );

            return base.add(state.doc, [delimiter(range.from, false), delimiter(range.to, true)]);
          },
          handleKeyDown(view, event) {
            if (event.isComposing || view.composing || !view.state.selection.empty) return false;
            const { state } = view;
            const range = getMarkRange(state.selection.$from, state.schema.marks.code);

            if (!range) return false;
            if (
              (event.key === "Backspace" || event.key === "Delete") &&
              (state.selection.from === range.from || state.selection.from === range.to)
            ) {
              view.dispatch(
                state.tr
                  .removeMark(range.from, range.to, state.schema.marks.code)
                  .removeStoredMark(state.schema.marks.code)
              );

              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

const highlightKey = new PluginKey<DecorationSet>("editorCodeHighlight");

/** Per-node cache: ProseMirror reuses unchanged nodes, so typing re-tokenizes only the edited block. */
const tokenCache = new WeakMap<
  ProseMirrorNode,
  Map<string, { from: number; to: number; className: string }[]>
>();

function highlightCode(doc: ProseMirrorNode, pending: Set<string>): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.type.spec.code) return;
    const language = typeof node.attrs.language === "string" ? node.attrs.language : "";
    const cached = tokenCache.get(node)?.get(language);
    const ranges = cached ?? tokenizeCode(node.textContent, language);

    if (!ranges) {
      if (language) pending.add(language);
    } else if (!cached) {
      const byLanguage = tokenCache.get(node) ?? new Map();

      byLanguage.set(language, ranges);
      tokenCache.set(node, byLanguage);
    }
    for (const range of ranges ?? [])
      decorations.push(
        Decoration.inline(pos + 1 + range.from, pos + 1 + range.to, { class: range.className })
      );

    return false;
  });

  return DecorationSet.create(doc, decorations);
}

/** Syntax colors for code blocks, as view-only decorations: the document and markdown are untouched. */
export const EditorCodeHighlight = Extension.create({
  name: "editorCodeHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: highlightKey,
        state: {
          init: (_, state) => highlightCode(state.doc, new Set()),
          apply: (transaction, previous, _old, state) =>
            transaction.docChanged || transaction.getMeta(highlightKey)
              ? highlightCode(state.doc, new Set())
              : previous,
        },
        props: { decorations: (state) => highlightKey.getState(state) },
        view(view) {
          const requested = new Set<string>();
          let destroyed = false;
          const ensure = () => {
            const pending = new Set<string>();

            highlightCode(view.state.doc, pending);
            for (const language of pending) {
              if (requested.has(language)) continue;
              requested.add(language);
              void preloadLanguage(language).then((loaded) => {
                requested.delete(language);
                if (loaded && !destroyed) view.dispatch(view.state.tr.setMeta(highlightKey, true));
              });
            }
          };

          ensure();

          return { update: ensure, destroy: () => void (destroyed = true) };
        },
      }),
    ];
  },
});
