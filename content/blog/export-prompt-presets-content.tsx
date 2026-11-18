import { BlogCode } from "@/components/blog/blog-code";
import { BlogSection } from "@/components/blog/blog-section";
import { ExportPresetDemo } from "@/components/blog/export-preset-demo";

const CONTRACT = `type ExportIntentPreset = {
  id: string;
  targets: ExportTarget[]; // open in a chat app, or copy for Cursor
  buttonLabel: string; // what the user reads
  question: string; // what we ask the other AI
  requestedFormat: string; // the shape we want back
  validate?: (sourceText: string) => ValidationResult; // optional pre-flight check
};`;

export function ExportPromptPresetsContent() {
  return (
    <>
      <BlogSection>
        <h1>Take your work to another AI</h1>
        <p className="text-lg leading-relaxed text-foreground/90">
          Sometimes the best next step is in a different tool: polishing a script in ChatGPT, or
          analysing code in Cursor. Moving your work there usually means writing a prompt and
          pasting context by hand. We reduced it to one button.
        </p>

        <h2>See what it writes</h2>
        <p>
          Pick a preset. The button is all a person sees. Below it is the prompt Organic LLM
          prepares for them, built from the same presets and builders the product uses, here on an
          invented launch note.
        </p>
      </BlogSection>

      <ExportPresetDemo />

      <BlogSection>
        <h2>Why a preset</h2>
        <p>
          A good prompt has a job, a question and a shape for the answer. We write those once, as a
          preset, so every export is consistent and easy to bring back into Organic LLM. The person
          sees a plain, task-shaped button such as <em>Request polished script from ChatGPT</em>,
          and none of the machinery.
        </p>
        <BlogCode
          caption="The contract each preset fills in."
          code={CONTRACT}
          language="typescript"
        />

        <h2>One button, several destinations</h2>
        <p>
          A preset names where it can go. Chat-app presets open a dropdown of providers (ChatGPT,
          Claude, Gemini, T3, v0 and Scira), with your last choice first. The Cursor preset copies a
          structured instruction to your clipboard, because that is how Cursor takes work today.
        </p>

        <h2>Organic LLM writes the prompt too</h2>
        <p>
          The preset sets the contract; Organic LLM can refine the final wording from your source
          text, any note you add, and the target&apos;s style. If that step fails, a deterministic
          builder still produces a complete, valid prompt, so the button always works.
        </p>

        <h2>A note on privacy</h2>
        <p>
          Exporting copies the text you selected to an outside service you choose. That text leaves
          Organic LLM, and the other service&apos;s own policies apply to it. Check what you are
          sharing before you press the button.
        </p>
      </BlogSection>
    </>
  );
}
