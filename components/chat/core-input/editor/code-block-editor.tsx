"use client";

import type { NodeViewProps } from "@tiptap/react";

import { FileCode2 } from "lucide-react";
import CodeBlock from "@tiptap/extension-code-block";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

import { codeLanguageLabel } from "@/components/shared/code-highlight";
import { CodeSurface } from "@/components/shared/code/code-surface";
import { CodeActions, CodeCopyButton, CodeWrapButton } from "@/components/shared/code/code-actions";
import { useCodeWrap } from "@/components/shared/code/use-code-wrap";
import styles from "@/components/shared/code-block.module.css";
import { cn } from "@/lib/utils";

function CodeBlockEditor({ node, editor, updateAttributes }: NodeViewProps) {
  const { wrapped, toggle } = useCodeWrap(false);
  const language = typeof node.attrs.language === "string" ? node.attrs.language : "";

  return (
    <NodeViewWrapper className="editor-code-block">
      <CodeSurface wrap={wrapped} data-embedded>
        <div className={cn(styles.header, "editor-code-header")} contentEditable={false}>
          <div className={styles.identity}>
            <FileCode2 size={14} aria-hidden />
            <label className={cn(styles.language, "editor-code-language")}>
              <span aria-hidden>{codeLanguageLabel(language)}</span>
              <select
                aria-label="Code block language"
                className="editor-code-language-select"
                disabled={!editor.isEditable}
                value={language}
                onChange={(event) => {
                  updateAttributes({ language: event.target.value || null });
                  // The select took DOM focus; hand it back to the caret's last position.
                  editor.commands.focus();
                }}
              >
                <option value="">Plain text</option>
                {language &&
                ![
                  "typescript",
                  "javascript",
                  "python",
                  "json",
                  "bash",
                  "html",
                  "css",
                  "sql",
                  "ts",
                  "js",
                ].includes(language) ? (
                  <option value={language}>{language}</option>
                ) : null}
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="json">JSON</option>
                <option value="bash">Shell</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="sql">SQL</option>
                <option value="ts">TS</option>
                <option value="js">JS</option>
              </select>
            </label>
          </div>
          <div className={cn(styles.headerActions, "editor-code-actions")}>
            <CodeActions>
              <CodeWrapButton pressed={wrapped} onToggle={toggle} />
              <CodeCopyButton ariaLabel="Copy code" text={node.textContent} />
            </CodeActions>
          </div>
        </div>
        <NodeViewContent<"pre">
          as="pre"
          className="editor-code-body"
          spellCheck={false}
          style={{ whiteSpace: wrapped ? "pre-wrap" : "pre" }}
        />
      </CodeSurface>
    </NodeViewWrapper>
  );
}

export const ComposerCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockEditor, { contentDOMElementTag: "code" });
  },
}).configure({ enableTabIndentation: true, defaultLanguage: "python" });
