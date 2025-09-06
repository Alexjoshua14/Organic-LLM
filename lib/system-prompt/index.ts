import OUTPUT_FORMAT_PROTOCOL from "./output-v0"; // Using the relesed prompt (i.e., default export) unless otherwise stated, like { OUTPUT_FORMAT_PROTOCOL_V2 as ...}
import STATE_UPDATE_PROTOCOLS_PROMPT_V0 from "./tool-prompt-v0";
import { SYSTEM_PROMPT } from "./prompt-v0";

const systemPrompt = SYSTEM_PROMPT.replace(
  "{{FORMATING_GUIDELINES}}",
  OUTPUT_FORMAT_PROTOCOL
).replace(
  "{{STATE_UPDATE_PROTOCOLS_PROMPT}}",
  STATE_UPDATE_PROTOCOLS_PROMPT_V0
);

export default systemPrompt;

// ## Response Structure
// Structure responses for clarity:
// - Use short headings when the content naturally divides into sections
// - Use bullet points or numbered lists for steps, options, or key takeaways
// - Keep paragraphs concise and scannable
